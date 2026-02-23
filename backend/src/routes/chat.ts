import type { FastifyPluginAsync } from "fastify";
import type { ChatHeader, Message } from "../lib/types";
import {
	dbGetChatID,
	dbGetChatIDs,
	dbGetLastMessages,
	dbGetMatchingUserHandles,
	dbGetMessages,
	dbResetUserChatUnseenMessages,
} from "../lib/db-utils";

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
	// Search for available users to chat with
	fastify.get<{ Querystring: { handle: string } }>(
		"/auth/search",
		async (request, reply) => {
			const userID: string = request.user as string;
			const handle = request.query.handle.toLowerCase();

			// Check handle length
			if (handle.length > 20)
				return reply
					.status(400)
					.send({ message: "Search handle is too long" });

			// Find all matching users
			const matchingUserIDs = await dbGetMatchingUserHandles(
				userID,
				handle,
			);

			// Get all connected users
			const connectedUsers = new Set<string>();
			for (const socket of fastify.io.sockets.sockets.values())
				connectedUsers.add(socket.userId);

			// Get existing chat ids for user
			const userChatIDs = await dbGetChatIDs(userID);

			// Fill out userToChatIDMap
			let userToChatIDMap: Record<string, string> = {};
			for (const { chatID, otherUserID } of userChatIDs) {
				userToChatIDMap[otherUserID] = chatID;
			}

			const users: {
				id: string;
				handle: string;
				connected: boolean;
				existingChatID: string | undefined;
			}[] = matchingUserIDs.map(({ userID, handle }) => ({
				id: userID,
				handle,
				connected: connectedUsers.has(userID),
				existingChatID: userToChatIDMap[userID],
			}));
			reply.send({ users });
		},
	);

	fastify.get("/auth/chats", async (request, reply) => {
		const userID = request.user as string;
		const connectedUsers = new Set<string>();
		for (const socket of fastify.io.sockets.sockets.values())
			connectedUsers.add(socket.userId);

		// Get existing chat ids for user
		const userChatIDs = await dbGetChatIDs(userID);
		const chatHeaders: ChatHeader[] = [];

		// Get last messages
		const lastMessages = await dbGetLastMessages(
			userChatIDs.map(({ chatID, lastMessageTime }) => ({
				chatID,
				messageTime: lastMessageTime,
			})),
		);
		if (lastMessages === null)
			return reply.send({
				chatHeaders,
			});

		// We have to construct this map because userChatIDs and lastMessages are not necessarily in the same order
		const chatIDToLastMessageMap: Record<string, Message> = {};
		for (const message of lastMessages) {
			chatIDToLastMessageMap[message.chatID] = {
				messageTime: message.messageTime,
				messageText: message.messageText,
				isUserA: message.isUserA,
			};
		}

		if (userChatIDs.length === lastMessages.length) {
			for (const {
				chatID,
				otherUserHandle,
				otherUserID,
				unseenMessages,
				isUserA,
			} of userChatIDs) {
				chatHeaders.push({
					id: chatID,
					otherUserHandle,
					isOtherUserConnected: connectedUsers.has(otherUserID),
					lastMessageHeader:
						chatIDToLastMessageMap[chatID]!.messageText.slice(
							0,
							10,
						) +
						(chatIDToLastMessageMap[chatID]!.messageText.length > 10
							? "..."
							: ""),
					lastMessageTime:
						chatIDToLastMessageMap[chatID]!.messageTime,
					unseenMessages,
					isAuthorOfLastMessage:
						isUserA === chatIDToLastMessageMap[chatID]!.isUserA,
				});
			}
		}

		reply.send({
			chatHeaders,
		});
	});

	// This query is really a get, but we make it a post because it updates the last seen chat message index
	fastify.post<{ Params: { id: string } }>(
		"/auth/chat/:id",
		async (request, reply) => {
			const chatID = request.params.id;
			const userID = request.user as string;

			// Get the user-chat id
			const userChatID = await dbGetChatID(userID, chatID);
			if (userChatID === null)
				return reply.status(404).send({ message: "Chat not found" });

			// Get the chat messages
			const messages = await dbGetMessages(chatID);

			// If the user has unseen messages, update the user-chat id
			if (userChatID.unseenMessages > 0)
				dbResetUserChatUnseenMessages(userID, chatID);

			reply.send({
				chat: {
					otherUserID: userChatID.otherUserID,
					otherUserHandle: userChatID.otherUserHandle,
					isUserA: userChatID.isUserA,
					messages,
				},
			});
		},
	);
};
