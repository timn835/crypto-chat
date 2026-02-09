import type { FastifyPluginAsync } from "fastify";
import { dbChats, dbUsers } from "..";
import type { ChatHeader } from "../lib/types";

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
	// Search for available users to chat with
	fastify.get<{ Querystring: { handle: string } }>(
		"/auth/search",
		(request, reply) => {
			const handle = request.query.handle;
			const users: {
				id: string;
				handle: string;
				connected: boolean;
				existingChatID: string | undefined;
			}[] = [];
			const connectedUsers = new Set<string>();
			for (const socket of fastify.io.sockets.sockets.values())
				connectedUsers.add(socket.userId);

			let userToChatIDMap: Record<string, string> = {};
			for (const user of dbUsers) {
				if (user.id === request.user) {
					for (const chatID of user.chatIDs) {
						const chat = dbChats.find(
							(dbChat) => dbChat.id === chatID,
						);
						if (!chat) continue;
						userToChatIDMap[
							chat.userIDA === request.user
								? chat.userIDB
								: chat.userIDA
						] = chat.id;
					}
					break;
				}
			}

			if (handle.length <= 20) {
				for (const user of dbUsers) {
					if (user.id === request.user) continue;
					if (user.handle.toLowerCase().includes(handle))
						users.push({
							id: user.id,
							handle: user.handle,
							connected: connectedUsers.has(user.id),
							existingChatID: userToChatIDMap[user.id],
						});
				}
			}
			reply.send({ users });
		},
	);

	fastify.get("/auth/chats", (request, reply) => {
		const userID = request.user;
		const connectedUsers = new Set<string>();
		for (const socket of fastify.io.sockets.sockets.values())
			connectedUsers.add(socket.userId);

		const chatHeaders: ChatHeader[] = dbChats
			.filter(
				({ userIDA, userIDB }) =>
					userIDA === userID || userIDB === userID,
			)
			.map(
				({
					id,
					messages,
					userIDA,
					userIDB,
					userHandleA,
					userHandleB,
				}) => ({
					id,
					otherUserHandle:
						userIDA === userID ? userHandleB : userHandleA,
					numOfMessages: messages.length,
					lastMessageHeader:
						messages[messages.length - 1]!.text.slice(0, 10) +
						(messages[messages.length - 1]!.text.length > 10
							? "..."
							: ""),
					lastMessageTime: messages[messages.length - 1]!.time,
					isAuthorOfLastMessage: messages[messages.length - 1]!
						.isUserA
						? userIDA === userID
						: userIDB === userID,
					isOtherUserConnected: connectedUsers.has(
						userIDA === userID ? userIDB : userIDA,
					),
				}),
			)
			.sort(
				(chatHeaderA, chatHeaderB) =>
					chatHeaderB.lastMessageTime - chatHeaderA.lastMessageTime,
			);
		reply.send({
			chatHeaders,
		});
	});

	fastify.get<{ Params: { id: string } }>(
		"/auth/chat/:id",
		(request, reply) => {
			const chatID = request.params.id;
			const userID = request.user;

			// Get the chat
			const chat = dbChats.find(({ id }) => id === chatID);
			if (!chat)
				return reply.status(404).send({ message: "Chat not found" });

			// Check if the user is part of the chat
			if (chat.userIDA !== userID && chat.userIDB !== userID)
				return reply
					.status(401)
					.send({ message: "User is not authorized in this chat" });

			reply.send({ chat });
		},
	);
};
