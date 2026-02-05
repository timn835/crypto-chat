import {
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types";
import { useAuth } from "@/auth";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function StartChatCart({ user }: { user: User | null }) {
	const { socket } = useAuth();
	const [error, setError] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

	const onFormSubmit = (evt: FormEvent<HTMLFormElement>) => {
		setIsSubmitting(true);
		setError("");
		try {
			evt.preventDefault();
			if (!socket || !user) return;

			// Get fields
			const data = new FormData(evt.currentTarget);
			const messageField = data.get("message");

			// Check required fields are non-empty
			if (!messageField) {
				setError("message");
				return;
			}

			const message = messageField.toString().trim();

			if (message.length > 1000) {
				setError("message");
				return;
			}
			socket.emit("start-chat", { userId: user.id, message });
		} catch (error) {
			console.error(error);
			setError("start-chat");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!user) return null;
	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>
					Start a chat with{" "}
					<span className="font-semibold">{user.handle}</span>
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
