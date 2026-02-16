import type { Chat, ChatHeader } from "@/lib/types";

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

export async function fetchChat(chatId: string): Promise<Chat | null> {
	try {
		const response = await fetch(
			`${import.meta.env.VITE_BACKEND_URL}/auth/chat/${chatId}`,
			{
				method: "POST", // POST request because it automatically updates the seen messages by the user
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({}),
			},
		);
		if (!response.ok) {
			const { message }: { message: string } = await response.json();
			throw Error(message);
		}

		const { chat } = await response.json();
		return chat;
	} catch (error) {
		console.error(error);
		return null;
	}
}
