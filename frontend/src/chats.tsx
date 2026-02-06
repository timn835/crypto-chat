import type { ChatHeader } from "./lib/types";

export async function fetchChats(): Promise<ChatHeader[]> {
	try {
		const response = await fetch(
			`${import.meta.env.VITE_BACKEND_URL}/auth/chats`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			},
		);
		if (!response.ok) {
			const { message }: { message: string } = await response.json();
			throw Error(message);
		}
		const { chatHeaders } = await response.json();
		return chatHeaders;
	} catch (error) {
		console.error(error);
		return [];
	}
}
