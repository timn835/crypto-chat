export type DBUser = {
	id: string;
	handle: string;
	hash: string;
	email: string;
};

export type Message = {
	messageText: string;
	isUserA: boolean;
	messageTime: number;
};

export type DBChat = {
	id: string;
	userIDA: string;
	userIDB: string;
	userHandleA: string;
	userHandleB: string;
	messages: Message[];
	userALastSeenMessageIndex: number;
	userBLastSeenMessageIndex: number;
};

export type ChatHeader = {
	id: string;
	otherUserHandle: string;
	isOtherUserConnected: boolean;
	lastMessageHeader: string;
	lastMessageTime: number;
	unseenMessages: number;
	isAuthorOfLastMessage: boolean;
};
