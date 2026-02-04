import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import type { User } from "./lib/types";
import { bytesToBase64 } from "./lib/utils";

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

	const isAuthenticated = !!user;

	const logout = useCallback(async () => {
		// Disconnect socket

		console.log("socket is:", socket);
		// socket?.disconnect();

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
			console.log("login useCallback running!!!");
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
				auth: {
					userId: user.id,
				},
			});
			console.log("logging in, socket is:", socket);
			setSocket(socket);

			// Set user
			setStoredUser(user);
			setUser(user);
		},
		[],
	);

	useEffect(() => {
		const storedUser = getStoredUser();
		setUser(storedUser);
		if (!storedUser) return;

		setUser(storedUser);

		const socket = io(import.meta.env.VITE_BACKEND_URL, {
			auth: {
				userId: storedUser.id,
			},
		});

		setSocket(socket);

		return () => {
			socket.disconnect();
		};
	}, []);

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
