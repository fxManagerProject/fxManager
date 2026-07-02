import { InfoIcon, ArrowRight } from 'lucide-react';
import { Label } from '@fxmanager/ui/components/label';
import { Input } from '@fxmanager/ui/components/input';
import { Button } from '@fxmanager/ui/components/button';
import { Alert, AlertDescription } from '@fxmanager/ui/components/alert';
import type { SetupFormData } from './types';

interface AccountStepProps {
	formData: SetupFormData;
	onChange: <K extends keyof SetupFormData>(
		field: K,
		value: SetupFormData[K],
	) => void;
	onNext: (e: React.FormEvent) => void;
}

export function AccountStep({ formData, onChange, onNext }: AccountStepProps) {
	return (
		<div className="max-w-md mx-auto w-full py-8">
			<form onSubmit={onNext} className="flex flex-col gap-4">
				<Alert className="items-center text-amber-500">
					<InfoIcon className="size-6" />
					<AlertDescription>
						The master administrative account bypasses standard role-permission
						mapping grids and is granted explicit operational system override
						powers.
					</AlertDescription>
				</Alert>

				<div className="flex flex-col gap-1.5">
					<Label htmlFor="username">Username</Label>
					<Input
						id="username"
						type="text"
						placeholder="admin"
						value={formData.username}
						onChange={(e) => onChange('username', e.target.value)}
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
						onChange={(e) => onChange('password', e.target.value)}
						required
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<Label htmlFor="confirm-password">Confirm master password</Label>
					<Input
						id="confirm-password"
						type="password"
						placeholder="••••••••"
						value={formData.confirmPassword}
						onChange={(e) => onChange('confirmPassword', e.target.value)}
						required
					/>
				</div>

				<Button type="submit" className="mt-2 w-full gap-2">
					Continue <ArrowRight className="size-4" />
				</Button>
			</form>
		</div>
	);
}
