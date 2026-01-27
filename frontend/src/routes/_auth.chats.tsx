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
	const { user } = useAuth();
	const data = Route.useLoaderData();
	if (!data || !user) return <div>Something went wrong</div>;

	return (
		<div className="grid grid-cols-3 md:grid-cols-5 min-h-125">
			<div className="col-span-1 py-2 pl-2 pr-4 md:border-r">
				<p className="mb-2">Choose a chat from the list below.</p>
				<ol className="grid gap-2">
					{data.chats.map(
						({ userIdA, userIdB, handleA, handleB, messages }) => {
							const chatId = `${userIdA}:${userIdB}`;
							return (
								<li key={chatId}>
									<Link
										to="/chats/$chatId"
										params={{ chatId: chatId }}
										className="text-blue-600 hover:opacity-75"
										activeProps={{
											className: "font-bold underline",
										}}>
										{`${user.id === userIdA ? handleB : handleA}(${messages})`}
									</Link>
								</li>
							);
						},
					)}
				</ol>
			</div>
			<div className="col-span-2 md:col-span-4 py-2 px-4">
				<Outlet />
			</div>
		</div>
	);
}
