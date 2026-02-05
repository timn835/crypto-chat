import type { FastifyPluginAsync } from "fastify";
import { dbChats, dbUsers } from "..";
import type { ChatHeader } from "../lib/types";

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
	// Search for available users to chat with
	fastify.get<{ Querystring: { handle: string } }>(
		"/auth/search",
		(request, reply) => {
			const handle = request.query.handle;
			const users: { id: string; handle: string; connected: boolean }[] =
				[];
			const connectedUsers = new Set<string>();
			for (const socket of fastify.io.sockets.sockets.values())
				connectedUsers.add(socket.userId);

			if (handle.length <= 20) {
				for (const user of dbUsers) {
					if (user.id === request.user) continue;
					if (user.handle.toLowerCase().includes(handle))
						users.push({
							id: user.id,
							handle: user.handle,
							connected: connectedUsers.has(user.id),
						});
				}
			}
			reply.send({ users });
		},
	);

	fastify.get("/auth/chats", (request, reply) => {
		const userID = request.user;
		const chatHeaders: ChatHeader[] = dbChats
			.filter(
				({ userIDA, userIDB }) =>
					userIDA === userID || userIDB === userID,
			)
			.map(({ id, messages, userIDA, userHandleA, userHandleB }) => ({
				id,
				otherUserHandle: userIDA === userID ? userHandleB : userHandleA,
				numOfMessages: messages.length,
				isFirstUser: userIDA === userID,
				lastMessageHeader:
					messages[messages.length - 1]?.text?.slice(0, 10) || "",
			}));
		reply.send({
			chatHeaders,
		});
	});
};
