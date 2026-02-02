import { useAuth } from "@/auth";
import { fetchChats } from "@/chats";
import { createFileRoute } from "@tanstack/react-router";
import { Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/chats")({
	loader: async ({ context }) => ({
		chats: await fetchChats(context.auth.user!.id),
	}),
	component: InvoicesRoute,
});

function InvoicesRoute() {
	const { user, socket } = useAuth();
	const data = Route.useLoaderData();

	if (!data || !user) return <div>Something went wrong</div>;

	const requestChat = (userId: string) => {
		if (!socket) return;
		socket.emit("request", { userId });
	};

	return <div className="">Chats route</div>;
}
