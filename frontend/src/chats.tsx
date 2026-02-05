import type { ChatHeader, Message } from "./lib/types";
import { sleep } from "./lib/utils";

const chats: Record<string, Message[]> = {
	"userA123:userB123": [
		{ idx: 0, text: "Hey what's up" },
		{ idx: 1, text: "not much" },
		{ idx: 2, text: "fooo" },
		{ idx: 3, text: "baar" },
		{ idx: 4, text: "a" },
		{ idx: 5, text: "v" },
		{ idx: 6, text: "d" },
		{ idx: 7, text: "s" },
		{ idx: 8, text: "a" },
		{ idx: 9, text: "Bye" },
	],
	"userA123:userC123": [
		{ idx: 0, text: "Hey what's up" },
		{ idx: 1, text: "not much" },
		{ idx: 2, text: "fooo" },
		{ idx: 3, text: "baar" },
		{ idx: 4, text: "a" },
		{ idx: 5, text: "v" },
		{ idx: 6, text: "d" },
		{ idx: 7, text: "s" },
		{ idx: 8, text: "a" },
		{ idx: 9, text: "Bye" },
		{ idx: 10, text: "Bye2" },
		{ idx: 11, text: "Bye3" },
	],
	"userD123:userA123": [
		{ idx: 0, text: "Akuna matata" },
		{ idx: 1, text: "No worries" },
		{ idx: 2, text: "alalal" },
		{ idx: 3, text: "zzz" },
	],
};

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

export async function fetchMessagesByChatId(
	chatId: string,
): Promise<Message[]> {
	await sleep(2000);
	return chats[chatId] || [];
}
