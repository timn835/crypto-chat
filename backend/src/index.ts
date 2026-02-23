import fcookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import dotenv from "dotenv";
import Fastify, { FastifyInstance } from "fastify";
import fastifySocketIO from "fastify-socket.io";
import { Server } from "socket.io";
import { COOKIE_NAME } from "./lib/constants";
import {
	dbGetChatIDs,
	dbGetOtherUserInChat,
	dbGetUser,
	dbResetUserChatUnseenMessages,
	dbStoreMessage,
	dbStoreUserChat,
	dbUpdateLastMessageTime,
} from "./lib/db-utils";
import type { ChatHeader, Message } from "./lib/types";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";

dotenv.config();

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
	fastify.io.on("connection", async (socket) => {
		console.log(
			`Socket connected! socket ID: ${socket.id}, user ID: ${socket.userId}`,
		);

		// Get user
		const dbUser = await dbGetUser(socket.userId);
		if (!dbUser) return;

		// Get chat ids
		const dbChatIDs = await dbGetChatIDs(socket.userId);

		// Join all user rooms & emit that socket has connected
		for (const { chatID } of dbChatIDs) {
			socket.join(chatID);
			socket.to(chatID).emit("user-connected", { chatID });
		}

		// Listen for start-chat event
		socket.on(
			"start-chat",
			async (data: {
				message: string;
				userId: string;
				newChatID: string;
				messageDate: number;
			}) => {
				// Find both users
				const userA = await dbGetUser(socket.userId);
				const userB = await dbGetUser(data.userId);
				if (!userA || !userB) return;

				// Get userA chat ids
				const userAChatIDs = await dbGetChatIDs(socket.userId);

				// Check that there isn't already a chat between the 2 users.
				// We will only check existing ids from userA's perspective.
				// it is good enough, as long as our DB is not in a broken state.
				for (const { otherUserID } of userAChatIDs) {
					if (otherUserID === data.userId) return;
				}

				// Create new message
				const newChatID = data.newChatID;
				const messageTime = await dbStoreMessage(
					newChatID,
					data.message.trim(),
					data.messageDate,
					true,
				);
				if (messageTime === -1) return;

				// Create new user-chat for userA
				dbStoreUserChat(
					socket.userId,
					newChatID,
					data.userId,
					userB.handle,
					true,
					messageTime,
					0,
				);

				// Create new user-chat for userB
				dbStoreUserChat(
					data.userId,
					newChatID,
					socket.userId,
					userA.handle,
					false,
					messageTime,
					1,
				);

				// Join userA
				socket.join(newChatID);

				const newChatHeader: ChatHeader = {
					id: newChatID,
					otherUserHandle: userA.handle,
					isOtherUserConnected: true,
					lastMessageHeader:
						data.message.slice(0, 10) +
						(data.message.length > 10 ? "..." : ""),
					lastMessageTime: messageTime,
					unseenMessages: 1,
					isAuthorOfLastMessage: false,
				};

				// Join userB if connected
				let isUserBConnected = false;
				for (const bSocket of fastify.io.sockets.sockets.values()) {
					if (bSocket.userId === data.userId) {
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
			async (data: {
				chatId: string;
				otherUserID: string;
				newMessage: Message;
			}) => {
				// Check that the user is allowed in the chat and that the other user is in the chat
				const otherUserID = await dbGetOtherUserInChat(
					socket.userId,
					data.chatId,
				);
				if (!otherUserID || otherUserID !== data.otherUserID) return;

				// Store the new message, checking the time for concurrency
				const messageTime = await dbStoreMessage(
					data.chatId,
					data.newMessage.messageText,
					data.newMessage.messageTime,
					data.newMessage.isUserA,
				);
				if (messageTime === -1) return;
				if (data.newMessage.messageTime !== messageTime)
					data.newMessage.messageTime = messageTime;

				// Update sender's user-chats last message time
				dbUpdateLastMessageTime(
					socket.userId,
					data.chatId,
					messageTime,
				);

				// Update receivers' user-chats unseen messages
				dbUpdateLastMessageTime(
					otherUserID,
					data.chatId,
					messageTime,
					1,
				);

				// Emit the event to the room
				socket.to(data.chatId).emit("new-message", {
					chatId: data.chatId,
					newMessage: data.newMessage,
				});
			},
		);

		// Listen for seen chat event
		socket.on(
			"seen-chat",
			(data: { chatId: string; lastMessageTime: number }) => {
				// Update the chat's last seen message time
				dbResetUserChatUnseenMessages(socket.userId, data.chatId);
			},
		);

		socket.on("disconnect", async () => {
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
				// Fetch all user-chats ids
				const userChatIDs = await dbGetChatIDs(socket.userId);
				for (const { chatID } of userChatIDs) {
					socket.to(chatID).emit("user-disconnected", { chatID });
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
