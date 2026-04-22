// React component for the setup process ONLY

import { useState } from 'react';
import { Server } from 'lucide-react';
import { InfoIcon } from 'lucide-react';
import { cn } from '@fxmanager/ui/lib/utils';
import { Label } from '@fxmanager/ui/components/label';
import { Input } from '@fxmanager/ui/components/input';
import { Button } from '@fxmanager/ui/components/button';
import { Alert, AlertDescription } from '@fxmanager/ui/components/alert';
import { QueryService } from './lib/query';

interface SetupFormData {
	username: string;
	password: string;
	confirmPassword: string;
}

interface SetupFormProps extends React.ComponentProps<'div'> {
	onSetupComplete?: () => void;
}

function SetupForm({ className, onSetupComplete, ...props }: SetupFormProps) {
	const [formData, setFormData] = useState<SetupFormData>({
		username: '',
		password: '',
		confirmPassword: '',
	});
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	function handleChange(field: keyof SetupFormData) {
		return (e: React.ChangeEvent<HTMLInputElement>) => {
			setFormData((prev) => ({ ...prev, [field]: e.target.value }));
			setError(null);
		};
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();

		if (formData.password !== formData.confirmPassword) {
			setError('Passwords do not match.');
			return;
		}

		if (formData.password.length < 8) {
			setError('Password must be at least 8 characters.');
			return;
		}

		setLoading(true);
		try {
			const result = await QueryService<{ success: boolean }>({
				endpoint: '/auth/setup',
				method: 'POST',
				body: {
					username: formData.username,
					password: formData.password,
				},
			});

			if (!result.success) {
				throw new Error('Setup failed.');
			}

			onSetupComplete?.();
			// hard reload so the server injects __SETUP_REQUIRED__ = false
			window.location.href = '/';
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className={cn('flex flex-col gap-6', className)} {...props}>
			<div className="flex flex-col items-center gap-2 text-center">
				<div className="relative flex size-10 items-center justify-center rounded-xl">
					<div className="absolute inset-0 rounded-xl bg-primary/50 blur-md" />
					<Server className="size-6 text-primary-foreground z-10" />
				</div>
				<h1 className="text-xl font-bold mt-5">
					<span className="text-primary">fx</span>Manager WebPanel
				</h1>
				<p className="text-sm text-muted-foreground">
					Create your master account to get started
				</p>
			</div>

			<Alert>
				<InfoIcon className="size-4" />
				<AlertDescription>
					This account will have{' '}
					<span className="font-medium text-foreground">
						master permissions
					</span>
					. Additional users can be added later.
				</AlertDescription>
			</Alert>

			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="username">Username</Label>
					<Input
						id="username"
						type="text"
						placeholder="john_doe"
						value={formData.username}
						onChange={handleChange('username')}
						required
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						type="password"
						placeholder="••••••••"
						value={formData.password}
						onChange={handleChange('password')}
						required
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<Label htmlFor="confirm-password">Confirm password</Label>
					<Input
						id="confirm-password"
						type="password"
						placeholder="••••••••"
						value={formData.confirmPassword}
						onChange={handleChange('confirmPassword')}
						required
					/>
				</div>

				<Button type="submit" className="mt-1 w-full" disabled={loading}>
					{loading ? 'Setting up...' : 'Create master account'}
				</Button>
			</form>

			{error && <p className="text-sm text-destructive text-center">{error}</p>}
		</div>
	);
}

export default function SetupApp() {
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-sm">
				<SetupForm />
			</div>
		</div>
	);
}
