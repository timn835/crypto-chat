import { createFileRoute } from "@tanstack/react-router";
import { redirect, useRouter, useRouterState } from "@tanstack/react-router";

import { useAuth } from "../auth";
import { sleep } from "@/lib/utils";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const dashboard = "/dashboard" as const;

export const Route = createFileRoute("/login")({
	beforeLoad: ({ context }) => {
		if (context.auth.isAuthenticated) {
			throw redirect({ to: dashboard });
		}
	},
	component: LoginComponent,
});

function LoginComponent() {
	const auth = useAuth();
	const router = useRouter();
	const isLoading = useRouterState({ select: (s) => s.isLoading });
	const navigate = Route.useNavigate();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const onFormSubmit = async (evt: FormEvent<HTMLFormElement>) => {
		setIsSubmitting(true);
		try {
			evt.preventDefault();
			const data = new FormData(evt.currentTarget);
			const fieldValue = data.get("username");

			if (!fieldValue) return;
			const username = fieldValue.toString();
			await auth.login(username);

			await router.invalidate();

			// This is just a hack being used to wait for the auth state to update
			// in a real app, you'd want to use a more robust solution
			await sleep(1);

			await navigate({ to: dashboard });
		} catch (error) {
			console.error("Error logging in: ", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const isLoggingIn = isLoading || isSubmitting;

	return (
		<div className="p-2 grid gap-2 place-items-center">
			<h3 className="text-xl">Login page</h3>
			<p>Login to see all the cool content in here.</p>
			<form className="mt-4 max-w-lg" onSubmit={onFormSubmit}>
				<fieldset disabled={isLoggingIn} className="w-full grid gap-2">
					<div className="grid gap-2 items-center min-w-75">
						<label
							htmlFor="username-input"
							className="text-sm font-medium">
							Username
						</label>
						<input
							id="username-input"
							name="username"
							placeholder="Enter your name"
							type="text"
							className="border rounded-md p-2 w-full"
							required
						/>
					</div>
					<Button type="submit">
						{isLoggingIn ? "Loading..." : "Login"}
					</Button>
				</fieldset>
			</form>
		</div>
	);
}
