export type User = {
	id: string;
	handle: string;
};

export type Chat = {
	userIdA: string;
	userIdB: string; // the id of the chat will be userIdA:userIdB
	handleA: string;
	handleB: string;
	messages: number;
};

export type Message = {
	idx: number;
	text: string;
	// In the db, there will be a chat id
};
