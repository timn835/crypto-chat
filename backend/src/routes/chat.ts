import type { FastifyPluginAsync } from "fastify";
import { dbUsers } from "..";

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
				connectedUsers.add(socket.handshake.auth.userId);

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

	// // Start a chat with another user
	// fastify.post<{Body: {userId: string, initialMessage: string}}>("/auth/start-chat", (request, reply) => {
	//     // Check userId is not user

	//     // Check user doesn't already have an existing chat with userId

	//     // Create the chat
	// })
};
