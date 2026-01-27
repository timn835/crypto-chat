import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function Card({ text }: { text: string }) {
	return (
		<div className="w-full bg-secondary rounded-md p-8 text-center text-xl font-semibold">
			{text}
		</div>
	);
}

function HomeComponent() {
	return (
		<div className="w-full p-8 space-y-8 min-h-screen flex flex-col justify-around">
			<h1 className="text-center text-4xl font-bold">CRYPTO-CHAT</h1>
			<p className="text-center px-8 text-lg">
				CRYPTO-CHAT is a free, secure messaging platform built for real
				private interactions. Chat end-to-end encrypted with anyone on
				the network, discover publicly available members, or make
				yourself visible to connect with new people. Exchange messages,
				documents, and payments — all protected by client-side
				encryption and smart contracts. No data harvesting. No
				middlemen. Just secure communication, powered by cryptography.
			</p>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Card text="Private end-to-end encrypted 1-on-1 messaging"></Card>
				<Card text="Securely exchange sensitive documents"></Card>
				<Card text="Send and receive crypto instantly"></Card>
				<Card text="Smart-contract escrow payments with delivery protection"></Card>
			</div>
			<div className="w-full text-center">
				<Link to="/login">
					<Button size="lg" className="w-80 h-20 text-2xl">
						{`<CHAT NOW>`}
					</Button>
				</Link>
			</div>
		</div>
	);
}
