import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/forgot-password")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="w-full min-h-screen flex justify-center items-center">
			<h1 className="text-3xl font-bold">Feature coming soon</h1>
		</div>
	)
}
