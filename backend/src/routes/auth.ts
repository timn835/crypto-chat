import argon2 from "argon2";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import {
	COOKIE_NAME,
	COOKIE_OPTIONS,
	STANDARD_COOKIE_OPTIONS,
} from "../lib/constants";
import type { DBUser } from "../lib/types";
import { decryptData, EMAIL_REGEX } from "../lib/utils";
import { dbUsers } from "..";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
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
			const [handle, password, email, create] =
				request.decryptedLoginData!;

			// Required params
			if (!handle || !password || (create !== "0" && create !== "1")) {
				return reply
					.status(401)
					.send({ message: "Invalid credentials" });
			}

			// Length check
			if (
				handle.length > 20 ||
				password.length > 30 ||
				(email && email.length > 99)
			) {
				return reply
					.status(401)
					.send({ message: "Invalid credentials" });
			}

			// Email check
			if (email && !EMAIL_REGEX.test(email)) {
				return reply
					.status(401)
					.send({ message: "Invalid credentials" });
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
				dbUser = {
					id: randomUUID(),
					handle,
					hash,
					email: email || "",
					chatIDs: [],
				};

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

				const isRightPassword = await argon2.verify(
					dbUser.hash,
					password,
				);
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

			return reply.send({
				user: { id: dbUser.id, handle: dbUser.handle },
			});
		},
	);

	fastify.post<{ Body: { socketId: string } }>(
		"/logout",
		(request, reply) => {
			reply.clearCookie(COOKIE_NAME, {
				...STANDARD_COOKIE_OPTIONS,
				...COOKIE_OPTIONS,
			});
			fastify.io.in(request.body.socketId).disconnectSockets();
			reply.send({ message: "ok" });
		},
	);
};
