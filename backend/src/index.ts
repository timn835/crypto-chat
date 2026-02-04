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

// An example HTTP route that emits a message to all connected clients
fastify.get("/", (request: FastifyRequest, reply: FastifyReply) => {
	fastify.io.emit("hello", "Hello from Fastify HTTP route!");
	reply.send({ status: "ok", message: "Hello event emitted" });
});

fastify.post<{ Body: { data: string; iv: string } }>(
	"/login",
	{
		preValidation: async (request, _reply) => {
			const { data, iv } = request.body;

			// Basic validation
			if (!data || !iv || data.length > 100 || iv.length > 100) {
				throw new Error("Invalid credentials");
			}

			// Decrypt
			try {
				request.decryptedLoginData = await decryptData(data, iv);
			} catch (err) {
				throw new Error("Invalid credentials");
			}
		},
	},
	async (request, reply) => {
		const [handle, password, email, create] = request.decryptedLoginData!;

		// Required params
		if (!handle || !password || (create !== "0" && create !== "1")) {
			return reply.status(401).send({ message: "Invalid credentials" });
		}

		// Length check
		if (
			handle.length > 20 ||
			password.length > 30 ||
			(email && email.length > 99)
		) {
			return reply.status(401).send({ message: "Invalid credentials" });
		}

		// Email check
		if (email && !EMAIL_REGEX.test(email)) {
			return reply.status(401).send({ message: "Invalid credentials" });
		}

		let dbUser: DBUser | undefined;

		if (create === "1") {
			// Create new user
			if (
				dbUsers.find(
					({ handle: dbUserHandle }) => handle === dbUserHandle,
				)
			) {
				return reply
					.status(401)
					.send({ message: "Handle already taken" });
			}

			const hash = await argon2.hash(password);
			dbUser = { id: randomUUID(), handle, hash, email: email || "" };

			dbUsers.push(dbUser);
		} else {
			// Login existing user
			dbUser = dbUsers.find(
				({ handle: dbUserHandle }) => dbUserHandle === handle,
			);
			if (!dbUser) {
				return reply
					.status(401)
					.send({ message: "Invalid credentials" });
			}

			const isRightPassword = await argon2.verify(dbUser.hash, password);
			if (!isRightPassword) {
				return reply
					.status(401)
					.send({ message: "Invalid credentials" });
			}
		}

		// Sign JWT and set cookie
		const refreshToken = fastify.jwt.sign(
			{ id: dbUser.id },
			{ expiresIn: 3122064000 }, // 99 years
		);

		reply.setCookie(COOKIE_NAME, refreshToken, {
			...STANDARD_COOKIE_OPTIONS,
			...COOKIE_OPTIONS,
		});

		console.log(dbUsers);

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

fastify.get<{ Querystring: { handle: string } }>(
	"/auth/search",
	(request, reply) => {
		console.log(dbUsers);
		const handle = request.query.handle;
		const users: { id: string; handle: string; connected: boolean }[] = [];
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

const start = async () => {
	try {
		await fastify.listen({ port: 3000, host: "0.0.0.0" });
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();
