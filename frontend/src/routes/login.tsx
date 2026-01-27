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
import { cn, EMAIL_REGEX, encryptData, sleep } from "@/lib/utils";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";

export const Route = createFileRoute("/login")({
	beforeLoad: ({ context }) => {
		if (context.auth.isAuthenticated) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: LoginComponent,
});

function LoginComponent() {
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [createAccount, setCreateAccount] = useState<boolean>(false);
	const [error, setError] = useState<string>("");

	const auth = useAuth();
	const router = useRouter();
	const isLoading = useRouterState({ select: (s) => s.isLoading });
	const navigate = Route.useNavigate();

	const onFormSubmit = async (evt: FormEvent<HTMLFormElement>) => {
		setIsSubmitting(true);
		try {
			evt.preventDefault();

			// Get fields
			const data = new FormData(evt.currentTarget);
			const handleField = data.get("handle");
			const emailField = data.get("email");
			const passwordField = data.get("password");
			const confirmPasswordField = data.get("confirm-password");

			// Check required fields are non-empty
			if (!handleField) {
				setError("handle");
				return;
			}
			if (!passwordField) {
				setError("password");
				return;
			}
			const handle = handleField.toString().trim();
			const password = passwordField.toString().trim();
			let create = false;

			// Check confirm password
			if (confirmPasswordField) {
				if (password !== confirmPasswordField.toString().trim()) {
					setError("confirm-password");
					return;
				}
				create = true;
			}

			// Check email
			const email = emailField ? emailField.toString().trim() : "";
			if (email && !EMAIL_REGEX.test(email)) {
				setError("email");
				return;
			}

			// Check maximum length on inputs
			if (handle.length > 20) {
				setError("handle");
				return;
			} else if (password.length > 30) {
				setError("password");
				return;
			} else if (email.length > 99) {
				setError("email");
				return;
			}

			// Encrypt data
			const dataToSend = await encryptData([
				handle,
				password,
				email,
				create ? "1" : "0",
			]);

			// console.log(dataToSend);
			// console.log(atob(await basicDecrypt(dataToSend)));

			await auth.login(dataToSend);
			await router.invalidate();
			await sleep(1);

			await navigate({ to: "/dashboard" });
		} catch (error) {
			console.error("Error logging in: ", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const isLoggingIn = isLoading || isSubmitting;

	return (
		<div className="w-full p-8 min-h-screen flex flex-col justify-center items-center gap-12">
			<div className="space-y-4">
				<h3 className="text-3xl font-bold">Login page</h3>
				<p className="xl font-semibold">Login to start chatting</p>
			</div>

			<form className="mt-4" onSubmit={onFormSubmit}>
				<fieldset disabled={isLoggingIn} className="w-full grid gap-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-75 md:min-w-3xl">
						<Field>
							<FieldLabel htmlFor="handle-input">
								Handle
							</FieldLabel>
							<Input
								id="handle-input"
								name="handle"
								type="text"
								placeholder="Enter your handle"
								className={cn({
									"border-2 border-red-500":
										error === "handle",
								})}
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
								className={cn({
									"border-2 border-red-500":
										error === "email",
								})}
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
								className={cn({
									"border-2 border-red-500":
										error === "password",
								})}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="confirm-password-input">
								Confirm password (new users only)
							</FieldLabel>
							<Input
								id="confirm-password-input"
								name="confirm-password"
								type="password"
								placeholder="Confirm your password"
								className={cn({
									"border-2 border-red-500":
										error === "confirm-password",
								})}
								onChange={(v) =>
									setCreateAccount(!!v.currentTarget.value)
								}
							/>
						</Field>
					</div>
					<div className="grid grid-cols-2 gap-6">
						<Button type="submit" className="w-full">
							{isLoggingIn
								? "Loading..."
								: createAccount
									? "Signup"
									: "Login"}
						</Button>
						<Link to="/forgot-password" className="w-full">
							<Button className="w-full">Forgot password</Button>
						</Link>
					</div>
				</fieldset>
			</form>
			<div className="grid md:grid-cols-2 gap-4 min-w-75 md:max-w-3xl">
				{" "}
				<p>
					* Confirm your password only if you are creating an account.
				</p>
				<p>
					** If you do not provide an email, don't forget your
					password!
				</p>
			</div>
		</div>
	);
}
