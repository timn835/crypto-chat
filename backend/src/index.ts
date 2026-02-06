import fcookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import dotenv from "dotenv";
import Fastify, { FastifyInstance } from "fastify";
import fastifySocketIO from "fastify-socket.io";
import { Server } from "socket.io";
import { COOKIE_NAME } from "./lib/constants";
import type { ChatHeader, DBChat, DBUser } from "./lib/types";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";
import { randomUUID } from "node:crypto";

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
		console.log("Socket connected! ID:", socket.id, socket.handshake.auth);

		// Listen for a custom event from the client
		socket.on(
			"start-chat",
			(data: { message: string; userId: string; newChatID: string }) => {
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
							time: new Date().getTime(),
						},
					],
				};
				dbChats.push(newChat);

				// Update user chats
				userA.chatIDs.push(newChatID);
				userB.chatIDs.push(newChatID);

				// Join userA
				socket.join(newChatID);

				// Join userB if connected
				for (const bSocket of fastify.io.sockets.sockets.values()) {
					if (bSocket.userId === userIDB) bSocket.join(newChatID);
				}

				// Emit chat-started event to the room
				const newChatHeader: ChatHeader = {
					id: newChat.id,
					otherUserHandle: userA.handle,
					isFirstUser: false,
					numOfMessages: 1,
					lastMessageHeader: data.message.slice(0, 10),
				};
				socket.to(newChatID).emit("chat-started", { newChatHeader });
			},
		);

		socket.on("disconnect", () => {
			console.log("Socket disconnected! ID:", socket.id, socket.userId);
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
