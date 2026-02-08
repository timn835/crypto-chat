import { useAuth } from "@/auth";
import { fetchChat } from "@/chats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Chat, ChatHeader, Message } from "@/lib/types";
import { cn, formatterUS } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SendIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/_auth/chats/$chatId")({
	component: ChatPage,
});

function ChatPage() {
	const { socket, user } = useAuth();
	const { chatId } = Route.useParams();
	const [error, setError] = useState<string>("");
	const queryClient = useQueryClient();

	const { data: chat, isLoading } = useQuery({
		queryKey: ["chat", chatId],
		queryFn: async () => await fetchChat(chatId),
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
			text: message,
			isUserA: user.id === chat.userIDA,
			time: new Date().getTime(),
		};
		const lastMessageHeader =
			message.slice(0, 10) + (message.length > 10 ? "..." : "");
		queryClient.setQueryData(
			["chats"],
			(oldData: ChatHeader[]): ChatHeader[] =>
				oldData.map((chatHeader) => {
					if (chatHeader.id !== chatId) return chatHeader;
					return {
						...chatHeader,
						lastMessageHeader,
						lastMessageTime: newMessage.time,
						isAuthorOfLastMessage: true,
					};
				}),
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
			newMessage,
		});

		// Clear the input
		evt.currentTarget.reset();
	};

	if (isLoading) return <div>...Loading...</div>;
	if (!chat || !user) return <div>Something went wrong</div>;

	const otherUserHandle =
		user.id === chat.userIDA ? chat.userHandleB : chat.userHandleA;

	return (
		<div className="grid gap-2">
			<div className="w-full flex">
				<div className="w-1/2">{otherUserHandle}</div>
				<div className="w-1/2">{user.handle}</div>
			</div>
			<div className="h-140 overflow-scroll px-2">
				{chat.messages.map(({ isUserA, text, time }, i) => {
					const isMyMessage = isUserA
						? user.id === chat.userIDA
						: user.id === chat.userIDB;
					return (
						<div
							key={`message-${i}`}
							className={cn("w-full flex p-1", {
								"justify-end": isMyMessage,
								"justify-start": !isMyMessage,
							})}>
							<Card
								className={cn("w-1/2 p-2", {
									"bg-blue-100": isMyMessage,
									"bg-green-100": !isMyMessage,
								})}>
								<CardContent>
									<p>{text}</p>
								</CardContent>
								<CardFooter
									className={cn("border-t-2", {
										"border-blue-500": isMyMessage,
										"border-green-500": !isMyMessage,
									})}>
									<p className="w-full text-end">{`${formatterUS.format(new Date(time))}`}</p>
								</CardFooter>
							</Card>
						</div>
					);
				})}
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
