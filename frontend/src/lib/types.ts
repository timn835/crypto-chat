export type User = {
	id: string;
	handle: string;
};

export type ChatHeader = {
	id: string;
	otherUserHandle: string;
	lastMessageHeader: string;
	lastMessageTime: number;
	isAuthorOfLastMessage: boolean;
};

export type Message = {
	idx: number;
	text: string;
	isUserA: boolean;
	// In the db, there will be a chat id
};
