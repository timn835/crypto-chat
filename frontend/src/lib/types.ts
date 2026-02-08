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
	userIDA: string;
	userIDB: string;
	userHandleA: string;
	userHandleB: string;
	messages: Message[];
};

export type ChatHeader = {
	id: string;
	otherUserHandle: string;
	isOtherUserConnected: boolean;
	lastMessageHeader: string;
	lastMessageTime: number;
	isAuthorOfLastMessage: boolean;
};
