import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Drawer } from "@/components/ui/drawer";
import { fetchChats } from "@/chats";
import { useAuth } from "@/auth";

export const Route = createFileRoute("/_auth")({
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/login",
			});
		}
	},
	loader: async ({ context }) => ({
		chats: await fetchChats(context.auth.user!.id),
	}),
	component: AuthLayout,
});

function AuthLayout() {
	const { user } = useAuth();
	const data = Route.useLoaderData();
	if (!data || !user) return <div>Something went wrong</div>;
	return (
		<Drawer>
			<div className="p-2">
				<Navbar />
				<div className="min-h-screen grid md:grid-cols-7 gap-2">
					<div className="hidden md:block md:col-span-1 p-4 border-2 h-full rounded-md">
						<p className="mb-2">Your chats</p>
						<ol className="grid gap-2">
							{data.chats.map(
								({
									userIdA,
									userIdB,
									handleA,
									handleB,
									messages,
								}) => {
									const chatId = `${userIdA}:${userIdB}`;
									return (
										<li key={chatId}>
											<Link
												to="/chats/$chatId"
												params={{ chatId: chatId }}
												className="text-blue-600 hover:opacity-75"
												activeProps={{
													className:
														"font-bold underline",
												}}>
												{`${user.id === userIdA ? handleB : handleA}(${messages})`}
											</Link>
										</li>
									);
								},
							)}
						</ol>
					</div>
					<div className="col-span-6 p-4 border-2 h-full rounded-md">
						<Outlet />
					</div>
				</div>
			</div>
		</Drawer>
	);
}
