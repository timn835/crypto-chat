import { useAuth } from "@/auth";
import { fetchChats } from "@/chats";
import { Navbar } from "@/components/Navbar";
import { Drawer } from "@/components/ui/drawer";
import { cn, formatterUS } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { DotIcon } from "lucide-react";

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
								}) => (
									<li key={id}>
										<Link
											to="/chats/$chatId"
											params={{ chatId: id }}
											className="text-center hover:text-blue-400 transition-colors">
											<p className="font-semibold text-xl flex justify-center items-center">
												<DotIcon
													className={cn("h-10 w-10", {
														"text-green-500":
															isOtherUserConnected,
														"text-red-500":
															!isOtherUserConnected,
													})}
												/>
												{otherUserHandle}
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
