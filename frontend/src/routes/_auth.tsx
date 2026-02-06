import { useAuth } from "@/auth";
import { fetchChats } from "@/chats";
import { Navbar } from "@/components/Navbar";
import { Drawer } from "@/components/ui/drawer";
import { formatterUS } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/login",
			});
		}
	},
	component: AuthLayout,
});

function AuthLayout() {
	const { user } = useAuth();
	const { data: chatHeaders } = useQuery({
		queryKey: ["chats"],
		queryFn: async () => await fetchChats(),
	});
	// const data = Route.useLoaderData();
	if (!chatHeaders || !user) return <div>Something went wrong</div>;

	return (
		<Drawer>
			<div className="p-2">
				<Navbar />
				<div className="min-h-screen grid md:grid-cols-10 gap-2">
					<div className="hidden md:block md:col-span-2 p-4 border-2 h-full rounded-md">
						<p className="mb-4 text-center">Your chats</p>
						<ol className="grid gap-4">
							{chatHeaders.map(
								({
									id,
									otherUserHandle,
									lastMessageHeader,
									numOfMessages,
									lastMessageTime,
									isFirstUser,
								}) => (
									<li key={id}>
										<Link
											to="/chats/$chatId"
											params={{ chatId: id }}
											className="text-center hover:text-blue-400 transition-colors">
											<p className="font-semibold text-xl">
												{otherUserHandle}
											</p>
											<p className="text-xs">{`${formatterUS.format(new Date(lastMessageTime))}`}</p>
											<p className="text-xs">{`${
												numOfMessages % 2 === 1 &&
												isFirstUser
													? "You"
													: otherUserHandle
											}: ${lastMessageHeader}`}</p>
										</Link>
									</li>
								),
							)}
						</ol>
					</div>
					<div className="md:col-span-8 p-4 border-2 h-full rounded-md">
						<Outlet />
					</div>
				</div>
			</div>
		</Drawer>
	);
}
