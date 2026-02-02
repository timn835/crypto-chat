import { createFileRoute } from "@tanstack/react-router";
import { Link, Outlet, redirect, useRouter } from "@tanstack/react-router";

import { useAuth } from "../auth";
import { Button } from "@/components/ui/button";

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
	const router = useRouter();
	const navigate = Route.useNavigate();
	const { user, logout } = useAuth();

	const handleLogout = () => {
		logout().then(() => {
			router.invalidate().finally(() => {
				navigate({ to: "/" });
			});
		});
	};

	return (
		<div className="p-2 h-full">
			<ul className="px-8 py-2 flex items-center justify-between gap-2">
				<li>
					<div className="w-full h-20 flex items-center text-xl font-bold">
						<img
							src="/malicious_clown_fish.png"
							className="w-full h-full object-contain"
						/>
						{user?.handle}
					</div>
				</li>
				<li>
					<Button
						variant="outline"
						size="lg"
						className="h-16 w-40 text-md font-semibold">
						<Link to="/dashboard">Dashboard</Link>
					</Button>
				</li>
				<li>
					<Button
						variant="outline"
						size="lg"
						className="h-16 w-40 text-md font-semibold">
						<Link to="/chats">Chats</Link>
					</Button>
				</li>
				<li>
					<Button
						variant="outline"
						size="lg"
						className="h-16 w-40 text-md font-semibold">
						<Link to="/profile">Profile</Link>
					</Button>
				</li>
				<li>
					<Button
						variant="outline"
						size="lg"
						className="h-16 w-40 text-md font-semibold"
						onClick={handleLogout}>
						Logout
					</Button>
				</li>
			</ul>
			<hr />
			<Outlet />
		</div>
	);
}
