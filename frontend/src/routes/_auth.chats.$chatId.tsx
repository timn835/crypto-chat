import { useAuth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/chats/$chatId")({
	component: ChatPage,
});

function ChatPage() {
	// Green for your message, blue for other persons message
	const { socket } = useAuth();

	const sendMessage = () => {
		if (!socket) return;
		socket.emit("message", { message: "hello" });
	};

	return (
		<section className="grid gap-2">
			chat page
			<div className="flex justify-center items-center">
				<Input placeholder="Message..." />
				<Button onClick={sendMessage}>Send</Button>
			</div>
		</section>
	);
}
