import {
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function StartChatCart({ handle }: { handle: string }) {
	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>
					Start a chat with{" "}
					<span className="font-semibold">{handle}</span>
				</DialogTitle>
				<DialogDescription className="sr-only">
					Enter the message below and press send to start a chat
				</DialogDescription>
			</DialogHeader>
			<Textarea className="resize-none" />
			<Button>Send</Button>
		</DialogContent>
	);
}
