import fcookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import dotenv from "dotenv";
import Fastify, { FastifyInstance } from "fastify";
import fastifySocketIO from "fastify-socket.io";
import { Server } from "socket.io";
import { COOKIE_NAME } from "./lib/constants";
import type { ChatHeader, DBChat, DBUser, Message } from "./lib/types";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";

dotenv.config();

export const dbUsers: DBUser[] = [];

export const dbChats: DBChat[] = [];

const fastify: FastifyInstance = Fastify({
	logger: true,
});

fastify.register(cors, {
	credentials: true,
	origin: (origin, cb) => {
		if (origin) {
			const hostname = new URL(origin).hostname;
			if (hostname === "localhost") {
				//  Request from localhost will pass
				cb(null, true);
				return;
			}
		}

		// Generate an error on other origins, disabling access
		cb(new Error("Not allowed"), false);
	},
});

// Register fjwt
fastify.register(fjwt, {
	decode: {
		complete: true,
	},
	secret: {
		public: Buffer.from(process.env.JWT_PUBLIC_KEY!, "base64").toString(
			"utf8",
		),
		private: Buffer.from(process.env.JWT_PRIVATE_KEY!, "base64").toString(
			"utf8",
		),
	},
});

// Register cookie
fastify.register(fcookie, {
	secret: process.env.COOKIE_SECRET!,
	hook: "preHandler",
	parseOptions: { httpOnly: true },
});

// Register the fastify-socket.io plugin
// The 'io' decorator is not automatically typed, so we use declaration merging below
fastify.register(fastifySocketIO, {
	cors: {
		origin: "http://localhost:5173",
		credentials: true,
		methods: ["GET", "POST"],
	},
});

// Use declaration merging to add the 'io' property to the FastifyInstance type
declare module "fastify" {
	interface FastifyInstance {
		io: Server;
	}
}

declare module "fastify" {
	interface FastifyRequest {
		decryptedLoginData?: string[];
	}
}

declare module "socket.io" {
	interface Socket {
		userId: string;
	}
}

fastify.after(() => {
	// Add request authentication
	fastify.addHook("preHandler", (request, reply, next) => {
		if (!request.url.startsWith("/auth/")) {
			next();
			return;
		}
		try {
			const refreshToken = request.cookies[COOKIE_NAME];
			if (!refreshToken) throw Error("No cookie");
			const { id }: { id: string; iat: number; exp: number } =
				fastify.jwt.verify(refreshToken);
			request.user = id;
			next();
		} catch (error) {
			return reply.status(401).send({
				message: `Access denied`,
			});
		}
	});

	// Add socket authentication
	fastify.io.use(async (socket, next) => {
		try {
			const cookieHeader = socket.request.headers.cookie;
			if (!cookieHeader) {
				return next(new Error("No cookie"));
			}

			const cookies = Object.fromEntries(
				cookieHeader.split("; ").map((c) => c.split("=")),
			);
			const token = cookies[COOKIE_NAME];

			if (!token) {
				return next(new Error("No token"));
			}
			const payload: { id: string; iat: number; exp: number } =
				fastify.jwt.verify(token);

			// attach user
			socket.userId = payload.id;

			next();
		} catch (err) {
			next(new Error("Unauthorized"));
		}
	});
});

fastify.ready((err) => {
	if (err) throw err;

	// Access the decorated 'io' instance
	fastify.io.on("connection", (socket) => {
		console.log(
			`Socket connected! socket ID: ${socket.id}, user ID: ${socket.userId}`,
		);

		// Join all user rooms & emit that socket has connected
		for (const dbUser of dbUsers) {
			if (dbUser.id === socket.userId) {
				for (const chatId of dbUser.chatIDs) {
					socket.join(chatId);
					socket.to(chatId).emit("user-connected", { chatId });
				}
				break;
			}
		}

		// Listen for start-chat event
		socket.on(
			"start-chat",
			(data: {
				message: string;
				userId: string;
				newChatID: string;
				messageDate: number;
			}) => {
				const userIDA = socket.userId;
				const userIDB = data.userId;

				// Find both users
				let userA: DBUser | undefined,
					userB: DBUser | undefined = undefined;
				for (const dbUser of dbUsers) {
					if (dbUser.id === userIDA) {
						userA = dbUser;
						if (userB) break;
					} else if (dbUser.id === userIDB) {
						userB = dbUser;
						if (userA) break;
					}
				}
				if (!userA || !userB) return;

				// Check that there isn't already a chat between the 2 users
				for (const chatID of userA.chatIDs) {
					const chat = dbChats.find(
						(dbChat) => dbChat.id === chatID,
					)!;
					if (chat.userIDA === userIDB || chat.userIDB === userIDB) {
						return;
					}
				}

				// Create new chat
				const newChatID = data.newChatID;
				const newChat: DBChat = {
					id: newChatID,
					userIDA,
					userIDB,
					userHandleA: userA.handle,
					userHandleB: userB.handle,
					messages: [
						{
							text: data.message,
							time: data.messageDate,
							isUserA: true,
						},
					],
					userALastSeenMessageIndex: 0,
					userBLastSeenMessageIndex: -1,
				};
				dbChats.push(newChat);

				// Update user chats
				userA.chatIDs.push(newChatID);
				userB.chatIDs.push(newChatID);

				// Join userA
				socket.join(newChatID);

				const newChatHeader: ChatHeader = {
					id: newChat.id,
					otherUserHandle: userA.handle,
					isOtherUserConnected: true,
					lastMessageHeader:
						data.message.slice(0, 10) +
						(data.message.length > 10 ? "..." : ""),
					lastMessageTime: newChat.messages[0]!.time,
					isAuthorOfLastMessage: false,
					unseenMessages: 1,
				};

				// Join userB if connected
				let isUserBConnected = false;
				for (const bSocket of fastify.io.sockets.sockets.values()) {
					if (bSocket.userId === userIDB) {
						if (!isUserBConnected) isUserBConnected = true;
						bSocket.join(newChatID);
					}
				}

				// Emit chat-started event to the recipient
				socket.to(newChatID).emit("chat-started", { newChatHeader });

				// Emit chat-started event to the originator
				newChatHeader.otherUserHandle = userB.handle;
				newChatHeader.isOtherUserConnected = isUserBConnected;
				newChatHeader.isAuthorOfLastMessage = true;
				newChatHeader.unseenMessages = 0;
				socket.emit("chat-started", { newChatHeader });
			},
		);

		// Listen for new-message event
		socket.on(
			"new-message",
			(data: { chatId: string; newMessage: Message }) => {
				for (let i = 0; i < dbChats.length; i++) {
					if (dbChats[i]!.id !== data.chatId) continue;

					// Add message to chat
					dbChats[i]!.messages.push(data.newMessage);

					// Adjust for potential concurrency
					let idx = dbChats[i]!.messages.length - 1;
					while (
						idx > 0 &&
						dbChats[i]!.messages[idx]!.time <
							dbChats[i]!.messages[idx - 1]!.time
					) {
						[
							dbChats[i]!.messages[idx],
							dbChats[i]!.messages[idx - 1],
						] = [
							dbChats[i]!.messages[idx - 1]!,
							dbChats[i]!.messages[idx]!,
						];
						idx--;
					}
					break;
				}

				// Emit the event
				socket.to(data.chatId).emit("new-message", data);
			},
		);

		// Listen for seen chat event
		socket.on("seen-chat", (data: { chatId: string }) => {
			// Update the chat's seen message index
			for (const dbChat of dbChats) {
				if (dbChat.id === data.chatId) {
					if (socket.userId === dbChat.userIDA) {
						dbChat.userALastSeenMessageIndex =
							dbChat.messages.length - 1;
					} else if (socket.userId === dbChat.userIDB) {
						dbChat.userBLastSeenMessageIndex =
							dbChat.messages.length - 1;
					}
					break;
				}
			}
		});

		socket.on("disconnect", () => {
			// Log disconnection
			console.log(
				`Socket disconnected! socket ID: ${socket.id}, user ID: ${socket.userId}`,
			);

			// If the user has no more sockets, emit disconnection to all rooms user is connected to
			let stillConnected = false;
			for (const potentialSocket of fastify.io.sockets.sockets.values()) {
				if (potentialSocket.id === socket.id) continue;
				if (potentialSocket.userId === socket.userId) {
					stillConnected = true;
					break;
				}
			}
			if (!stillConnected) {
				for (const dbUser of dbUsers) {
					if (dbUser.id === socket.userId) {
						for (const chatId of dbUser.chatIDs) {
							socket
								.to(chatId)
								.emit("user-disconnected", { chatId });
						}
						break;
					}
				}
			}
		});
	});
});

fastify.register(authRoutes);
fastify.register(chatRoutes);

// An example HTTP route that emits a message to all connected clients
fastify.get("/", (_request, reply) => {
	fastify.io.emit("hello", "Hello from Fastify HTTP route!");
	reply.send({ status: "ok", message: "Hello event emitted" });
});

const start = async () => {
	try {
		await fastify.listen({ port: 3000, host: "0.0.0.0" });
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();
