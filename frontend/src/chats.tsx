import type { Chat, Message } from "./lib/types";
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

export async function fetchChats(userId: string): Promise<Chat[]> {
	console.log("fetching chats for userId:", userId);
	await sleep(2000);
	return [
		{
			userIdA: "userA123",
			userIdB: "userB123",
			handleA: "Tim",
			handleB: "Alice",
			messages: 10,
		},
		{
			userIdA: "userA123",
			userIdB: "userC123",
			handleA: "Tim",
			handleB: "Bob",
			messages: 12,
		},
		{
			userIdA: "userD123",
			userIdB: "userA123",
			handleA: "Tom",
			handleB: "Tim",
			messages: 4,
		},
	];
}

export async function fetchMessagesByChatId(
	chatId: string,
): Promise<Message[]> {
	await sleep(2000);
	return chats[chatId] || [];
}
