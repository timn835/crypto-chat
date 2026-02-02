import { useAuth } from "@/auth";
import { fetchMessagesByChatId } from "@/chats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/chats/$chatId")({
	loader: async ({
		params: { chatId },
		context,
	}): Promise<{ chat: Message[]; placement: "A" | "B" }> => {
		return {
			chat: await fetchMessagesByChatId(chatId),
			placement: chatId.startsWith(context.auth.user!.id) ? "A" : "B",
		};
	},
	component: ChatPage,
});

function ChatPage() {
	// Green for your message, blue for other persons message
	const { chat, placement } = Route.useLoaderData();
	const { socket } = useAuth();

	const sendMessage = () => {
		if (!socket) return;
		socket.emit("message", { message: "hello" });
	};

	return (
		<section className="grid gap-2">
			{chat.map(({ idx, text }) => {
				const even = idx % 2 === 0;
				const green =
					(placement === "A" && even) || (placement === "B" && !even);
				return (
					<p
						className={cn({
							"bg-green-100": green,
							"bg-blue-100": !green,
						})}
						key={idx}>
						{text}
					</p>
				);
			})}
			<div className="flex justify-center items-center">
				<Input placeholder="Message..." />
				<Button onClick={sendMessage}>Send</Button>
			</div>
		</section>
	);
}
