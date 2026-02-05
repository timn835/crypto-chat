export type User = {
	id: string;
	handle: string;
};

export type ChatHeader = {
	id: string;
	otherUserHandle: string;
	isFirstUser: boolean;
	numOfMessages: number;
	lastMessageHeader: string;
};

export type Message = {
	idx: number;
	text: string;
	// In the db, there will be a chat id
};
