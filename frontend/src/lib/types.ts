export type User = {
	id: string;
	handle: string;
};

export type Message = {
	messageText: string;
	isUserA: boolean;
	messageTime: number;
};

export type Chat = {
	otherUserID: string;
	otherUserHandle: string;
	isUserA: boolean;
	messages: Message[];
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
