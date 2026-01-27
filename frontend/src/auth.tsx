import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { sleep } from "./lib/utils";
import type { User } from "./lib/types";

export interface AuthContext {
	isAuthenticated: boolean;
	login: (username: string) => Promise<void>;
	logout: () => Promise<void>;
	user: User | null;
}

const AuthContext = createContext<AuthContext | null>(null);

const key = "crypto-chat.auth.user";

function getStoredUser(): User | null {
	const storedUser = localStorage.getItem(key);
	if (storedUser === null) return null;
	console.log(storedUser);
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
	const isAuthenticated = !!user;

	const logout = useCallback(async () => {
		await sleep(250);

		setStoredUser(null);
		setUser(null);
	}, []);

	const login = useCallback(async (handle: string) => {
		await sleep(500);
		const user = { id: "userA123", handle };
		setStoredUser(user);
		setUser(user);
	}, []);

	useEffect(() => {
		setUser(getStoredUser());
	}, []);

	return (
		<AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
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
