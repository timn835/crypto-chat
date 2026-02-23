import { useAuth } from "@/auth";
import { fetchChat, fetchChats } from "@/chats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Chat, ChatHeader, Message } from "@/lib/types";
import { cn, formatterUS } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SendIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

export const Route = createFileRoute("/_auth/chats/$chatId")({
	component: ChatPage,
});

function ChatPage() {
	const { socket, user } = useAuth();
	const { chatId } = Route.useParams();
	const [error, setError] = useState<string>("");
	const containerRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();

	const { data: chat, isLoading: isChatLoading } = useQuery({
		queryKey: ["chat", chatId],
		queryFn: async () => await fetchChat(chatId),
	});

	const { data: chatHeaders, isLoading: areChatHeadersLoading } = useQuery({
		queryKey: ["chats"],
		queryFn: async () => {
			const fetchedHeaders = await fetchChats();
			// The adjustment is necessary when navigating to this chats/$chatId from a non-chat route
			return fetchedHeaders.map((chatHeader) =>
				chatHeader.id === chatId
					? { ...chatHeader, unseenMessages: 0 }
					: chatHeader,
			);
		},
	});

	const onFormSubmit = (evt: FormEvent<HTMLFormElement>) => {
		if (!socket || !chat || !user) return;
		setError("");
		evt.preventDefault();
		const data = new FormData(evt.currentTarget);
		const messageField = data.get("message");

		// Check required fields are non-empty
		if (!messageField) {
			setError("message");
			return;
		}

		const message = messageField.toString().trim();

		// Check maximum length on inputs
		if (message.length > 1000) {
			setError("message");
			return;
		}

		// Update frontend chat headers
		const newMessage: Message = {
			messageText: message,
			isUserA: chat.isUserA,
			messageTime: new Date().getTime(),
		};
		const lastMessageHeader =
			message.slice(0, 10) + (message.length > 10 ? "..." : "");
		queryClient.setQueryData(
			["chats"],
			(oldData: ChatHeader[]): ChatHeader[] => {
				const newData: ChatHeader[] = [
					{
						id: chatId,
						otherUserHandle: "",
						isOtherUserConnected: false,
						lastMessageHeader,
						lastMessageTime: newMessage.messageTime,
						isAuthorOfLastMessage: true,
						unseenMessages: 0,
					},
				];

				for (const chatHeader of oldData) {
					if (chatHeader.id !== chatId) {
						newData.push(chatHeader);
						continue;
					}
					newData[0].otherUserHandle = chatHeader.otherUserHandle;
					newData[0].isOtherUserConnected =
						chatHeader.isOtherUserConnected;
				}
				return newData;
			},
		);

		// Update frontend chat
		queryClient.setQueryData(
			["chat", chatId],
			(oldData: Chat): Chat => ({
				...oldData,
				messages: [...oldData.messages, newMessage],
			}),
		);

		// Emit new message
		socket.emit("new-message", {
			chatId,
			otherUserID: chat.otherUserID,
			newMessage,
		});

		// Clear the input
		evt.currentTarget.reset();
	};

	useEffect(() => {
		// useEffect for automatic scroll
		if (!chat) return;
		containerRef.current?.scrollTo({
			top: containerRef.current.scrollHeight,
			behavior: "smooth",
		});
		// The adjustment is necessary when navigating to this chats/$chatId from anotether chats/$chatId
		queryClient.setQueryData(["chats"], (oldData: ChatHeader[]) =>
			oldData.map((h) =>
				h.id === chatId ? { ...h, unseenMessages: 0 } : h,
			),
		);
	}, [chat]);

	if (isChatLoading || areChatHeadersLoading) return <div>...Loading...</div>;
	if (!chat || !user) return <div>Something went wrong</div>;

	const otherUserConnected = !!chatHeaders?.find(
		(chatHeader) => chatHeader.id === chatId,
	)?.isOtherUserConnected;

	return (
		<div className="grid gap-2">
			<div className="w-full flex text-2xl font-semibold">
				<div
					className={cn("w-1/2", {
						"text-green-500": otherUserConnected,
					})}>
					{`${chat.otherUserHandle} - ${otherUserConnected ? "online" : "offline"}`}
				</div>
				<div className="w-1/2">{user.handle}</div>
			</div>
			<div ref={containerRef} className="h-140 overflow-scroll px-2">
				{chat.messages.map(
					({ isUserA, messageText, messageTime }, i) => {
						const isMyMessage = isUserA === chat.isUserA;
						return (
							<div
								key={`message-${i}`}
								className={cn("w-full flex p-1", {
									"justify-end": isMyMessage,
									"justify-start": !isMyMessage,
								})}>
								<Card
									className={cn("max-w-3/4 w-fit p-2", {
										"bg-blue-100": isMyMessage,
										"bg-green-100": !isMyMessage,
									})}>
									<CardContent>
										<p className="wrap-break-word">
											{messageText}
										</p>
									</CardContent>
									<CardFooter
										className={cn("border-t-2", {
											"border-blue-500": isMyMessage,
											"border-green-500": !isMyMessage,
										})}>
										<p className="w-full text-end">{`${formatterUS.format(new Date(messageTime))}`}</p>
									</CardFooter>
								</Card>
							</div>
						);
					},
				)}
			</div>
			<form
				className="flex justify-center items-center gap-2"
				onSubmit={onFormSubmit}>
				<Input
					id="message-input"
					name="message"
					type="text"
					placeholder="Message..."
					className={cn({
						"border-2 border-red-500": error === "handle",
					})}
					required
				/>
				<Button type="submit">
					<SendIcon />
				</Button>
			</form>
		</div>
	);
}
