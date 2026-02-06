export type DBUser = {
	id: string;
	handle: string;
	hash: string;
	email: string;
	chatIDs: string[]; // all ids user is currently participating in
};

export type Message = {
	text: string;
	time: number;
	isUserA: boolean;
};

export type DBChat = {
	id: string;
	userIDA: string;
	userIDB: string;
	userHandleA: string;
	userHandleB: string;
	messages: Message[];
};

export type ChatHeader = {
	id: string;
	otherUserHandle: string;
	lastMessageHeader: string;
	lastMessageTime: number;
	isAuthorOfLastMessage: boolean;
};
