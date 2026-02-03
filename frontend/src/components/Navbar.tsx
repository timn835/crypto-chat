import { Link, useNavigate, useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { MenuIcon } from "lucide-react";
import { useAuth } from "../auth";

export function Navbar() {
	const { user, logout } = useAuth();
	const router = useRouter();
	const navigate = useNavigate();

	const handleLogout = async () => {
		try {
			await logout();
			router.invalidate();
		} catch (error) {
			console.error(error);
		} finally {
			navigate({ to: "/" });
		}
	};

	return (
		<ul className="px-8 py-2 flex items-center justify-between gap-2 h-1/10">
			<li>
				<div className="h-16 w-32 lg:w-40 flex items-center text-xl font-bold">
					<img
						src="/malicious_clown_fish.png"
						className="w-full h-full object-contain"
					/>
					{user?.handle}
				</div>
			</li>
			<li>
				<Link to="/dashboard">
					<Button
						variant="outline"
						size="lg"
						className="h-16 w-32 lg:w-40 hidden sm:block text-md font-semibold">
						Home
					</Button>
				</Link>
			</li>
			<li>
				<Link to="/chats">
					<Button
						variant="outline"
						size="lg"
						className="h-16 w-32 lg:w-40 hidden sm:block text-md font-semibold">
						Chats
					</Button>
				</Link>
			</li>
			<li>
				<Link to="/profile">
					<Button
						variant="outline"
						size="lg"
						className="h-16 w-32 lg:w-40 hidden sm:block text-md font-semibold">
						Profile
					</Button>
				</Link>
			</li>
			<li>
				<Button
					variant="outline"
					size="lg"
					className="h-16 w-32 lg:w-40 hidden sm:block text-md font-semibold"
					onClick={handleLogout}>
					Logout
				</Button>
			</li>
			<li>
				<div className="sm:hidden h-16 w-32 lg:w-40 flex items-center justify-end">
					<DrawerTrigger asChild>
						<Button variant="secondary">
							<MenuIcon />
						</Button>
					</DrawerTrigger>
					<DrawerContent className="h-full text-center">
						<DialogTitle className="hidden">Navbar</DialogTitle>
						<DialogDescription className="hidden">
							Navbar for mobile view
						</DialogDescription>
						<ul className="flex flex-col gap-4 mt-8">
							<li>
								<Link to="/dashboard">
									<Button variant="outline" className="w-3/4">
										Home
									</Button>
								</Link>
							</li>
							<li>
								<Link to="/chats">
									<Button variant="outline" className="w-3/4">
										Chats
									</Button>
								</Link>
							</li>
							<li>
								<Link to="/profile">
									<Button variant="outline" className="w-3/4">
										Profile
									</Button>
								</Link>
							</li>
							<li>
								<Button
									variant="outline"
									className="w-3/4"
									onClick={logout}>
									Logout
								</Button>
							</li>
						</ul>
					</DrawerContent>
				</div>
			</li>
		</ul>
	);
}
