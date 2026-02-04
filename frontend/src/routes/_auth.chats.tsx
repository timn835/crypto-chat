import { useAuth } from "@/auth";
import { fetchChats } from "@/chats";
import { StartChatCart } from "@/components/StartChatCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/_auth/chats")({
	loader: async ({ context }) => ({
		chats: await fetchChats(context.auth.user!.id),
	}),
	component: InvoicesRoute,
});

function InvoicesRoute() {
	const { user } = useAuth();
	const data = Route.useLoaderData();
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [error, setError] = useState<string>("");
	const [foundUsers, setFoundUsers] = useState<
		(User & { connected: boolean })[] | null
	>();
	const [chosenHandle, setChosenHandle] = useState<string>("");

	if (!data || !user) return <div>Something went wrong</div>;

	// const requestChat = (userId: string) => {
	// 	if (!socket) return;
	// 	socket.emit("request", { userId });
	// };

	const onFormSubmit = async (evt: FormEvent<HTMLFormElement>) => {
		setIsSubmitting(true);
		try {
			evt.preventDefault();

			// Get fields
			const data = new FormData(evt.currentTarget);
			const handleField = data.get("handle");

			// Check required fields are non-empty
			if (!handleField) {
				setError("handle");
				return;
			}
			const handle = handleField.toString().toLowerCase().trim();

			// Check maximum length on inputs
			if (handle.length > 20) {
				setError("handle");
				return;
			}

			//////////////////////////////////////////////////////////////////////////////////////////////////

			const response = await fetch(
				`${import.meta.env.VITE_BACKEND_URL}/auth/search?handle=${handle}`,
				{
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
					credentials: "include",
				},
			);
			if (!response.ok) {
				const { message }: { message: string } = await response.json();
				throw Error(message);
			}
			const { users } = await response.json();
			setFoundUsers(users);
			//////////////////////////////////////////////////////////////////////////////////////////////////

			// await sleep(1000);
			// if (handle === "kim")
			// 	setFoundUsers([
			// 		{
			// 			id: "987rty",
			// 			handle: "Kim",
			// 			connected: true,
			// 		},
			// 		{
			// 			id: "876bgr",
			// 			handle: "Kimmy",
			// 			connected: false,
			// 		},
			// 		{
			// 			id: "032",
			// 			handle: "Kimosaurus",
			// 			connected: true,
			// 		},
			// 	]);
			// else setFoundUsers([]);
		} catch (error) {
			console.error("Error searching handle: ", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-8">
			<h2>Find a member</h2>
			<form className="mt-4" onSubmit={onFormSubmit}>
				<fieldset disabled={isSubmitting} className="w-full flex gap-6">
					<Field className="grid grid-cols-10">
						<Input
							id="handle-input"
							name="handle"
							type="text"
							placeholder="Enter member handle"
							className={cn("col-span-9", {
								"border-2 border-red-500": error === "handle",
							})}
							required
						/>
					</Field>
					<Button type="submit" className="w-40">
						{isSubmitting ? "Loading..." : "Search"}
					</Button>
				</fieldset>
			</form>
			<div className="">
				{!!foundUsers && !isSubmitting ? (
					foundUsers.length ? (
						<Dialog>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Handle</TableHead>
										<TableHead>Status</TableHead>
										{/* <TableHead>Message</TableHead> */}
										<TableHead className="text-right">
											Start Chat
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{foundUsers.map(
										({ id, handle, connected }) => (
											<TableRow key={id}>
												<TableCell>{handle}</TableCell>
												<TableCell
													className={cn({
														"text-green-500":
															connected,
														"text-red-500":
															!connected,
													})}>
													{/* <DotIcon className="h-20 w-20" /> */}
													{connected
														? "Online"
														: "Offline"}
												</TableCell>
												<TableCell className="text-right">
													<DialogTrigger
														onClick={() =>
															setChosenHandle(
																handle,
															)
														}
														className="bg-blue-100 p-2 rounded-md cursor-pointer hover:bg-blue-300 transition-colors">
														Select
													</DialogTrigger>
												</TableCell>
											</TableRow>
										),
									)}
								</TableBody>
							</Table>
							<StartChatCart handle={chosenHandle} />
						</Dialog>
					) : (
						<p>No users were found</p>
					)
				) : null}
			</div>
		</div>
	);
}
