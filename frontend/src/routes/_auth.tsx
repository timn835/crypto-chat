import { useAuth } from "@/auth";
import { fetchChats } from "@/chats";
import { Navbar } from "@/components/Navbar";
import { Drawer } from "@/components/ui/drawer";
import type { ChatHeader } from "@/lib/types";
import { cn, formatterUS } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
	const queryClient = useQueryClient();
	// const data = Route.useLoaderData();
	if (!chatHeaders || !user) return <div>Something went wrong</div>;

	return (
		<Drawer>
			<div className="p-2">
				<Navbar />
				<div className="grid md:grid-cols-10 gap-2">
					<div className="hidden md:block md:col-span-2 p-4 border-2 h-full rounded-md">
						<p className="mb-4 text-center">Your chats</p>
						<ol className="grid gap-4">
							{chatHeaders.map(
								({
									id,
									otherUserHandle,
									isOtherUserConnected,
									lastMessageHeader,
									lastMessageTime,
									isAuthorOfLastMessage,
									unseenMessages,
								}) => (
									<li key={id}>
										<Link
											to="/chats/$chatId"
											params={{ chatId: id }}
											className="text-center hover:text-blue-400 transition-colors">
											<p
												className={cn(
													"font-semibold text-xl flex justify-center items-center",
													{
														"text-green-500":
															isOtherUserConnected,
													},
												)}>
												{otherUserHandle}
												{unseenMessages ? (
													<span className="mx-1 px-2 rounded-md bg-green-500 text-accent">
														{unseenMessages}
													</span>
												) : null}
											</p>
											<p className="text-xs">{`${formatterUS.format(new Date(lastMessageTime))}`}</p>
											<p className="text-xs">{`${
												isAuthorOfLastMessage
													? "you"
													: otherUserHandle
											}: ${lastMessageHeader}`}</p>
										</Link>
									</li>
								),
							)}
						</ol>
					</div>
					<div className="h-170 md:col-span-8 p-4 border-2 rounded-md">
						<Outlet />
					</div>
				</div>
			</div>
		</Drawer>
	);
}
