import Fastify, {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
} from "fastify";
import fastifySocketIO from "fastify-socket.io";
import { Server } from "socket.io";
import type { User } from "./lib/types";

const users: User[] = [];

const fastify: FastifyInstance = Fastify({
	logger: true,
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

const start = async () => {
	try {
		await fastify.listen({ port: 3000, host: "0.0.0.0" });
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();
