import fcookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import argon2 from "argon2";
import dotenv from "dotenv";
import Fastify, {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
} from "fastify";
import fastifySocketIO from "fastify-socket.io";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import {
	COOKIE_NAME,
	COOKIE_OPTIONS,
	STANDARD_COOKIE_OPTIONS,
} from "./lib/constants";
import type { DBUser } from "./lib/types";
import { decryptData, EMAIL_REGEX } from "./lib/utils";

dotenv.config();

const dbUsers: DBUser[] = [];
const connectedUserIDs = new Set<string>();

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
			console.log("Socket disconnected! ID:", socket.id);
		});
	});
});

// An example HTTP route that emits a message to all connected clients
fastify.get("/", (request: FastifyRequest, reply: FastifyReply) => {
	fastify.io.emit("hello", "Hello from Fastify HTTP route!");
	reply.send({ status: "ok", message: "Hello event emitted" });
});

fastify.post<{ Body: { data: string; iv: string } }>(
	"/login",
	{
		preValidation: async (request, _reply, done) => {
			// Check encrypted data
			const { data, iv } = request.body;
			if (!data || !iv || data.length > 100 || iv.length > 100) {
				done(new Error("Invalid credentials"));
				return;
			}

			// Decrypt data
			try {
				request.decryptedLoginData = await decryptData(data, iv);
				done();
			} catch (error) {
				done(new Error("Invalid credentials"));
				return;
			}
		},
	},
	async (request, reply) => {
		const [handle, password, email, create] = request.decryptedLoginData!;

		// Check required parameters
		if (!handle || !password || (create !== "0" && create !== "1"))
			return reply.status(401).send({ message: "Invalid credentials" });

		// Check length
		if (
			handle.length > 20 ||
			password.length > 30 ||
			(email && email.length > 99)
		)
			return reply.status(401).send({ message: "Invalid credentials" });

		// Check email
		if (email && !EMAIL_REGEX.test(email))
			return reply.status(401).send({ message: "Invalid credentials" });

		let dbUser: DBUser | undefined;

		// Create user
		if (create === "1") {
			// Check if handle already exists
			if (
				dbUsers.find(
					({ handle: dbUserHandle }) => handle === dbUserHandle,
				)
			)
				return reply
					.status(401)
					.send({ message: "Handle already taken" });

			// Hash password
			const hash = await argon2.hash(password);
			dbUser = { id: randomUUID(), handle, hash, email: email || "" };

			// Store the user
			dbUsers.push(dbUser);
		} else {
			// Check if user exists
			dbUser = dbUsers.find(
				({ handle: dbUserHandle }) => dbUserHandle === handle,
			);
			if (!dbUser)
				return reply
					.status(401)
					.send({ message: "Invalid credentials" });

			// Verify password hash
			const isRightPassword = await argon2.verify(dbUser.hash, password);
			if (!isRightPassword)
				return reply
					.status(401)
					.send({ message: "Invalid credentials" });
		}

		// Login existing user
		const refreshToken = fastify.jwt.sign(
			{ id: dbUser.id },
			{ expiresIn: 3122064000 }, // 60*60*24*365*99 = 99 years
		);
		reply.setCookie(COOKIE_NAME, refreshToken, {
			...STANDARD_COOKIE_OPTIONS,
			...COOKIE_OPTIONS,
		});

		return reply.send({ user: { id: dbUser.id, handle: dbUser.handle } });
	},
);

fastify.post<{ Body: { socketId: string } }>("/logout", (request, reply) => {
	reply.clearCookie(COOKIE_NAME, {
		...STANDARD_COOKIE_OPTIONS,
		...COOKIE_OPTIONS,
	});
	fastify.io.in(request.body.socketId).disconnectSockets();
	reply.send({ message: "ok" });
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
