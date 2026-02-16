export type User = {
	id: string;
	handle: string;
};

export type Message = {
	text: string;
	isUserA: boolean;
	time: number;
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
	isAuthorOfLastMessage: boolean;
	unseenMessages: number; // number of unseen messages by the user in this chat
};
