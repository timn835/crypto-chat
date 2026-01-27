import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { sleep } from "@/lib/utils";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";

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
			const handleField = data.get("handle");
			const emailField = data.get("email");
			const passwordField = data.get("password");
			const confirmPasswordField = data.get("confirm-password");

			if (!handleField || !passwordField) return;

			const handle = handleField.toString();
			const password = passwordField.toString();
			if (
				confirmPasswordField &&
				password !== confirmPasswordField.toString()
			)
				return;

			const email = emailField ? emailField.toString() : "";

			console.log(handle, password, email);

			await auth.login(handle);
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
		<div className="w-full p-8 min-h-screen flex flex-col justify-around items-center">
			<div className="space-y-4">
				<h3 className="text-3xl font-bold">Login page</h3>
				<p className="xl font-semibold">Login to start chatting</p>
			</div>

			<form className="mt-4 max-w-lg" onSubmit={onFormSubmit}>
				<fieldset disabled={isLoggingIn} className="w-full grid gap-6">
					<div className="grid gap-6 min-w-75 md:min-w-96">
						<Field>
							<FieldLabel htmlFor="handle-input">
								Handle
							</FieldLabel>
							<Input
								id="handle-input"
								name="handle"
								type="text"
								placeholder="Enter your handle"
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="handle-input">
								Email (optional)
							</FieldLabel>
							<Input
								id="email-input"
								name="email"
								type="email"
								placeholder="Enter your email"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="password-input">
								Password
							</FieldLabel>
							<Input
								id="password-input"
								name="password"
								type="password"
								placeholder="Enter your password"
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="confirm-password-input">
								Confirm password
							</FieldLabel>
							<Input
								id="confirm-password-input"
								name="confirm-password"
								type="password"
								placeholder="Confirm your password"
							/>
						</Field>
					</div>
					<div className="grid grid-cols-2 space-x-2">
						<Button type="submit">
							{isLoggingIn ? "Loading..." : "Login"}
						</Button>
						<Link to="/reset-password" className="w-full">
							<Button className="w-full">Reset password</Button>
						</Link>
					</div>
				</fieldset>
			</form>
			<div className="max-w-96 space-y-8">
				{" "}
				<p>
					* Confirm your password only if you are creating an account.
				</p>
				<p>
					** If you do not enter an email, we cannot reset your
					password automatically in case it is lost.
				</p>
			</div>
		</div>
	);
}
