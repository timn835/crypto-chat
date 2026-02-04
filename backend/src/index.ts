import fcookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import dotenv from "dotenv";
import Fastify, { FastifyInstance } from "fastify";
import fastifySocketIO from "fastify-socket.io";
import { Server } from "socket.io";
import { COOKIE_NAME } from "./lib/constants";
import type { DBUser } from "./lib/types";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";

dotenv.config();

export const dbUsers: DBUser[] = [];

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
		origin: "*", // Adjust CORS as needed for your client
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

fastify.after(() => {
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
});

fastify.ready((err) => {
	if (err) throw err;

	// Access the decorated 'io' instance
	fastify.io.on("connection", (socket) => {
		console.log("Socket connected! ID:", socket.id, socket.handshake.auth);

		// Listen for a custom event from the client
		socket.on("message", (data: { message: string }) => {
			console.log("Received message from client:", data.message);
			// Emit a response back to the client
			socket.emit("server-message", `Server received: ${data}`);
		});

		socket.on("disconnect", () => {
			console.log(
				"Socket disconnected! ID:",
				socket.id,
				socket.handshake.auth,
			);
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
