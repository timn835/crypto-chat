import {
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ChatHeader, User } from "@/lib/types";
import { useAuth } from "@/auth";
import {
	useState,
	type Dispatch,
	type FormEvent,
	type SetStateAction,
} from "react";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export function StartChatCart({
	chosenUser,
	setChosenUser,
	setFoundUsers,
}: {
	chosenUser: User | null;
	setChosenUser: Dispatch<SetStateAction<User | null>>;
	setFoundUsers: Dispatch<
		SetStateAction<
			| (User & {
					connected: boolean;
					existingChatID: string | undefined;
			  })[]
			| null
		>
	>;
}) {
	const { socket } = useAuth();
	const queryClient = useQueryClient();
	const [error, setError] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

	const onFormSubmit = (evt: FormEvent<HTMLFormElement>) => {
		setIsSubmitting(true);
		setError("");
		try {
			evt.preventDefault();
			if (!socket || !chosenUser) return;

			// Get fields
			const data = new FormData(evt.currentTarget);
			const messageField = data.get("message");

			// Check required fields are non-empty
			if (!messageField) {
				setError("message");
				return;
			}

			const message = messageField.toString().trim();

			// Check length
			if (message.length > 1000) {
				setError("message");
				return;
			}

			const newChatID = crypto.randomUUID();
			const messageDate = new Date().getTime();

			// Emit event
			socket.emit("start-chat", {
				userId: chosenUser.id,
				newChatID,
				message,
				messageDate,
			});

			// Manually adjust query
			queryClient.setQueryData(
				["chats"],
				(oldData: ChatHeader[]): ChatHeader[] => [
					{
						id: newChatID,
						otherUserHandle: chosenUser.handle,
						lastMessageHeader:
							message.slice(0, 10) +
							(message.length > 10 ? "..." : ""),
						lastMessageTime: messageDate,
						isAuthorOfLastMessage: true,
					},
					...oldData,
				],
			);

			// Adjust previously found users to be unable to start a chat with the same user again
			setFoundUsers((prevFoundUsers) => {
				if (!prevFoundUsers) return [];
				return prevFoundUsers.map((prevFoundUser) =>
					prevFoundUser.id === chosenUser.id
						? { ...prevFoundUser, existingChatID: newChatID }
						: prevFoundUser,
				);
			});

			// Close dialog by setting chosen user to null
			setChosenUser(null);
		} catch (error) {
			console.error(error);
			setError("start-chat");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!chosenUser) return null;

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>
					Start a chat with{" "}
					<span className="font-semibold">{chosenUser.handle}</span>
				</DialogTitle>
				<DialogDescription className="sr-only">
					Enter the message below and press send to start a chat
				</DialogDescription>
			</DialogHeader>
			<form className="mt-4" onSubmit={onFormSubmit}>
				<fieldset disabled={isSubmitting} className="space-y-4">
					<Field>
						<Textarea
							id="message-input"
							name="message"
							placeholder="Enter your message"
							className={cn("resize-none", {
								"border-2 border-red-500": error === "message",
							})}
							required
						/>
					</Field>
					<div className="w-full text-right">
						<Button type="submit">Send</Button>
					</div>
				</fieldset>
			</form>
			{error === "start-chat" ? (
				<p className="text-red-500">Unable to start chat</p>
			) : null}
		</DialogContent>
	);
}
