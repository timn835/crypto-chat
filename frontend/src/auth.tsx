import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import type { Chat, ChatHeader, Message, User } from "./lib/types";
import { bytesToBase64 } from "./lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export interface AuthContext {
	isAuthenticated: boolean;
	login: (data: string, iv: Uint8Array<ArrayBuffer>) => Promise<void>;
	logout: () => Promise<void>;
	user: User | null;
	socket: Socket | null;
}

const AuthContext = createContext<AuthContext | null>(null);

const key = "crypto-chat.auth.user";

function getStoredUser(): User | null {
	const storedUser = localStorage.getItem(key);
	if (storedUser === null) return null;
	return JSON.parse(storedUser);
}

function setStoredUser(user: User | null) {
	if (user) {
		localStorage.setItem(key, JSON.stringify(user));
	} else {
		localStorage.removeItem(key);
	}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(getStoredUser());
	const [socket, setSocket] = useState<Socket | null>(null);
	const queryClient = useQueryClient();

	const isAuthenticated = !!user;

	const logout = useCallback(async () => {
		// Disconnect socket
		socket?.disconnect();

		// Logout to remove the cookie
		const response = await fetch(
			`${import.meta.env.VITE_BACKEND_URL}/logout`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ socketId: socket?.id || "" }),
			},
		);
		if (!response.ok) throw Error("Unable to log out");

		setStoredUser(null);
		setUser(null);
	}, [socket]);

	const login = useCallback(
		async (data: string, iv: Uint8Array<ArrayBuffer>) => {
			const response = await fetch(
				`${import.meta.env.VITE_BACKEND_URL}/login`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					credentials: "include",
					body: JSON.stringify({ data, iv: bytesToBase64(iv) }),
				},
			);
			if (!response.ok) {
				const { message }: { message: string } = await response.json();
				throw Error(message);
			}
			const { user }: { user: User } = await response.json();

			// Connect socket
			const socket = io(import.meta.env.VITE_BACKEND_URL, {
				withCredentials: true,
			});
			setSocket(socket);

			// Set user
			setStoredUser(user);
			setUser(user);
		},
		[],
	);

	// This useEffect will reconnect whenever we refresh the page
	useEffect(() => {
		const storedUser = getStoredUser();
		setUser(storedUser);
		if (!storedUser) return;

		setUser(storedUser);

		const socket = io(import.meta.env.VITE_BACKEND_URL, {
			withCredentials: true,
		});

		setSocket(socket);

		return () => {
			socket.disconnect();
		};
	}, []);

	// This useEffect will listen to whenever we receive messages/notifications/events from the socket
	useEffect(() => {
		// Listen to user connexions to update the chatHeaders connected state
		socket?.on("user-connected", ({ chatId }: { chatId: string }) => {
			console.log("ATTENTION: a user has connected");
			// Update frontend chat headers
			queryClient.setQueryData(
				["chats"],
				(oldData: ChatHeader[]): ChatHeader[] =>
					oldData.map((chatHeader) => {
						if (chatHeader.id !== chatId) return chatHeader;
						return {
							...chatHeader,
							isOtherUserConnected: true,
						};
					}),
			);
		});

		// Listen for chat-started event, this will also update the headers for the one who actually started the chat
		socket?.on(
			"chat-started",
			({ newChatHeader }: { newChatHeader: ChatHeader }) => {
				queryClient.setQueryData(["chats"], (oldData: ChatHeader[]) => [
					newChatHeader,
					...oldData,
				]);
			},
		);

		// Listen for new-message event, it will only be emitted to the receiver (unlike the chat-started event)
		socket?.on(
			"new-message",
			({
				chatId,
				newMessage,
			}: {
				chatId: string;
				newMessage: Message;
			}) => {
				// Update frontend chat headers
				const lastMessageHeader =
					newMessage.text.slice(0, 10) +
					(newMessage.text.length > 10 ? "..." : "");
				queryClient.setQueryData(
					["chats"],
					(oldData: ChatHeader[]): ChatHeader[] =>
						oldData.map((chatHeader) => {
							if (
								chatHeader.id !== chatId ||
								chatHeader.lastMessageTime > newMessage.time
							)
								return chatHeader;
							return {
								...chatHeader,
								lastMessageHeader,
								lastMessageTime: newMessage.time,
								isAuthorOfLastMessage: false,
							};
						}),
				);

				// Update frontend chat
				queryClient.setQueryData(
					["chat", chatId],
					(oldData: Chat): Chat => {
						const newMessages = [...oldData.messages, newMessage];
						// Adjust for potential concurrency
						let idx = newMessages.length - 1;
						while (
							idx > 0 &&
							newMessages[idx].time < newMessages[idx - 1]!.time
						) {
							[newMessages[idx], newMessages[idx - 1]] = [
								newMessages[idx - 1]!,
								newMessages[idx]!,
							];
							idx--;
						}
						return {
							...oldData,
							messages: newMessages,
						};
					},
				);
			},
		);

		// Listen to user disconnexions to update the chatHeaders connected state
		socket?.on("user-disconnected", ({ chatId }: { chatId: string }) => {
			// Update frontend chat headers
			queryClient.setQueryData(
				["chats"],
				(oldData: ChatHeader[]): ChatHeader[] =>
					oldData.map((chatHeader) => {
						if (chatHeader.id !== chatId) return chatHeader;
						return {
							...chatHeader,
							isOtherUserConnected: false,
						};
					}),
			);
		});
	}, [socket]);

	return (
		<AuthContext.Provider
			value={{ isAuthenticated, user, login, logout, socket }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
