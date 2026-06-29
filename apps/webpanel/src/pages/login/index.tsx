import { useAuth } from '@/hooks/use-auth';
import type { ApiError } from '@fxmanager/shared/types';
import { Button } from '@fxmanager/ui/components/button';
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from '@fxmanager/ui/components/field';
import { Input } from '@fxmanager/ui/components/input';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@fxmanager/ui/components/tooltip';
import { cn } from '@fxmanager/ui/lib/utils';
import { Server } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
	const { login } = useAuth();
	const [formData, setData] = useState<{ username: string; password: string }>({
		username: '',
		password: '',
	});
	const [error, setError] = useState<string | null>(null);

	function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		login(formData.username, formData.password).catch((error) => {
			const err = error as ApiError<{ error?: string }>;

			if (err.status === 401) {
				setError('Invalid Credentials');
			} else {
				setError(err.data?.error ?? err.message);
			}
		});
	}

	return (
		<div className={cn('flex flex-col gap-6', className)} {...props}>
			<form onSubmit={(e) => handleSubmit(e)}>
				<FieldGroup>
					<div className="flex flex-col items-center gap-2 text-center">
						<div className="flex flex-col items-center gap-2 font-medium group">
							<div className="relative flex size-10 items-center justify-center rounded-xl">
								<div className="absolute inset-0 rounded-xl bg-primary/50 blur-md" />

								<Server className="size-6 text-primary-foreground z-10" />
							</div>
							<span className="sr-only">Fx Manager</span>
						</div>
						<h1 className="text-xl font-bold mt-5">
							<span className="text-primary">fx</span>Manager WebPanel
						</h1>
					</div>
					<Field>
						<FieldLabel htmlFor="username">Username</FieldLabel>
						<Input
							id="username"
							type="text"
							placeholder="john_doe"
							value={formData.username}
							onChange={(e) =>
								setData((prev) => ({ ...prev, username: e.target.value }))
							}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="password">Password</FieldLabel>
						<Input
							id="password"
							type="password"
							placeholder="password"
							value={formData.password}
							onChange={(e) =>
								setData((prev) => ({ ...prev, password: e.target.value }))
							}
							required
						/>
					</Field>
					<Field>
						<Button type="submit">Login</Button>
					</Field>

					<FieldSeparator>Or Use</FieldSeparator>

					<div className="flex w-full flex-row gap-2">
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex-1">
									<Button
										variant="outline"
										type="button"
										className="w-full"
										disabled
									>
										<svg
											role="img"
											viewBox="0 0 24 24"
											xmlns="http://www.w3.org/2000/svg"
											height="18"
											width="18"
											className="mr-2"
										>
											<title>Cfx.re Icon</title>
											<path
												d="M22.4 24h-5.225c-0.117 0 -0.455 -1.127 -1.026 -3.375 -1.982 -6.909 -3.124 -10.946 -3.417 -12.12l3.37 -3.325h0.099c0.454 1.42 2.554 7.676 6.299 18.768ZM12.342 7.084h-0.048a3.382 3.385 0 0 1 -0.098 -0.492v-0.098a102.619 102.715 0 0 1 3.272 -3.275c0.13 0.196 0.196 0.356 0.196 0.491v0.05a140.694 140.826 0 0 1 -3.322 3.324ZM5.994 10.9h-0.05c0.67 -2.12 1.076 -3.209 1.223 -3.275L14.492 0.343c0.08 0 0.258 0.524 0.533 1.562zm1.37 -4.014h-0.05C8.813 2.342 9.612 0.048 9.71 0h4.495v0.05a664.971 664.971 0 0 1 -6.841 6.839Zm-2.69 7.874h-0.05c0.166 -0.798 0.554 -1.418 1.174 -1.855a312.918 313.213 0 0 1 5.71 -5.717h0.05c-0.117 0.672 -0.375 1.175 -0.781 1.52zM1.598 24l-0.098 -0.05c1.399 -4.172 2.148 -6.322 2.248 -6.45l6.74 -6.694v0.05C10.232 11.88 8.974 16.263 6.73 24Z"
												fill="currentColor"
											/>
										</svg>
										Cfx.re
									</Button>
								</div>
							</TooltipTrigger>
							<TooltipContent side="bottom">Coming Soon...</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex-1">
									<Button
										variant="outline"
										type="button"
										className="w-full"
										disabled
									>
										<svg
											height="18"
											width="18"
											viewBox="0 0 24 24"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
											className="mr-2"
										>
											<title>Discord Icon</title>
											<path
												d="M18.59 5.88997C17.36 5.31997 16.05 4.89997 14.67 4.65997C14.5 4.95997 14.3 5.36997 14.17 5.69997C12.71 5.47997 11.26 5.47997 9.83001 5.69997C9.69001 5.36997 9.49001 4.95997 9.32001 4.65997C7.94001 4.89997 6.63001 5.31997 5.40001 5.88997C2.92001 9.62997 2.25001 13.28 2.58001 16.87C4.23001 18.1 5.82001 18.84 7.39001 19.33C7.78001 18.8 8.12001 18.23 8.42001 17.64C7.85001 17.43 7.31001 17.16 6.80001 16.85C6.94001 16.75 7.07001 16.64 7.20001 16.54C10.33 18 13.72 18 16.81 16.54C16.94 16.65 17.07 16.75 17.21 16.85C16.7 17.16 16.15 17.42 15.59 17.64C15.89 18.23 16.23 18.8 16.62 19.33C18.19 18.84 19.79 18.1 21.43 16.87C21.82 12.7 20.76 9.08997 18.61 5.88997H18.59ZM8.84001 14.67C7.90001 14.67 7.13001 13.8 7.13001 12.73C7.13001 11.66 7.88001 10.79 8.84001 10.79C9.80001 10.79 10.56 11.66 10.55 12.73C10.55 13.79 9.80001 14.67 8.84001 14.67ZM15.15 14.67C14.21 14.67 13.44 13.8 13.44 12.73C13.44 11.66 14.19 10.79 15.15 10.79C16.11 10.79 16.87 11.66 16.86 12.73C16.86 13.79 16.11 14.67 15.15 14.67Z"
												fill="currentColor"
											/>
										</svg>
										Discord
									</Button>
								</div>
							</TooltipTrigger>
							<TooltipContent side="bottom">Coming Soon...</TooltipContent>
						</Tooltip>
					</div>
				</FieldGroup>
			</form>
			<span className="text-red-500 text-center">{error}</span>
		</div>
	);
}

export default function LoginPage() {
	const { user } = useAuth();

	if (user) {
		return <Navigate to="/dashboard" replace />;
	}

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
			<div className="w-full max-w-sm">
				<LoginForm />
			</div>
		</div>
	);
}
