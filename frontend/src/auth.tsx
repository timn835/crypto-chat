import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { sleep } from "./lib/utils";
import type { User } from "./lib/types";
import { io, type Socket } from "socket.io-client";

export interface AuthContext {
	isAuthenticated: boolean;
	login: (data: string) => Promise<void>;
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
		await sleep(250);

		setStoredUser(null);
		setUser(null);
	}, []);

	const login = useCallback(async (data: string) => {
		console.log(data);
		await sleep(500);
		const user = { id: "userA123", handle: "Timmy" };

		setSocket(socket);
		setStoredUser(user);
		setUser(user);
	}, []);

	useEffect(() => {
		const storedUser = getStoredUser();
		setUser(storedUser);
		if (!storedUser) return;

		setUser(storedUser);

		const socket = io("http://localhost:3000", {
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
