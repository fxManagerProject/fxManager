import { useState, useEffect } from 'react';
import { Server } from 'lucide-react';
import { cn } from '@fxmanager/ui/lib/utils';

import type { SetupFormData, SetupSteps } from './types';
import { AccountStep } from './AccountStep';
import { ServerStep } from './ServerStep';
import { PermissionsStep } from './PermissionsStep';
import { ImportStep } from './ImportStep';
import { QueryService } from '@/lib/query';
import { toast } from 'sonner';
import type { ApiError } from '@fxmanager/shared/types';

export function SetupApp() {
	const [step, setStep] = useState<SetupSteps>('account');
	const [formData, setFormData] = useState<SetupFormData>({
		username: '',
		password: '',
		confirmPassword: '',
		serverSetupMethod: 'manual',
		fxserverPath: '',
		resourcePath: '',
		adminGroups: [],
	});

	const [loading, setLoading] = useState(false);

	function setError(message: string) {
		toast.error('An error occured', {
			description: message,
			position: 'top-right',
			dismissible: true,
			closeButton: true,
			richColors: true,
			duration: 10_000,
		});
	}

	function handleChange<K extends keyof SetupFormData>(
		field: K,
		value: SetupFormData[K],
	) {
		setFormData((prev) => ({ ...prev, [field]: value }));
	}

	function handleAccountNext(e: React.FormEvent) {
		e.preventDefault();
		if (formData.password !== formData.confirmPassword) {
			setError('Passwords do not match.');
			return;
		}
		if (formData.password.length < 8) {
			setError('Password must be at least 8 characters.');
			return;
		}
		setStep('server');
	}

	async function handleFinalSubmit() {
		setLoading(true);
		try {
			const result = await QueryService<{ success: boolean }>({
				endpoint: '/setup',
				method: 'POST',
				body: {
					username: formData.username,
					password: formData.password,
					server: {
						method: formData.serverSetupMethod,
						fxserverPath: formData.fxserverPath,
						resourcePath: formData.resourcePath,
					},
					customGroups: formData.adminGroups,
				},
			});

			if (!result.success) {
				throw new Error('Setup configuration failed.');
			}

			setStep('import');
		} catch (err) {
			const error = err as ApiError<{ error?: string }>;
			setError(
				`(${error.status}) - ${error.data?.error ?? 'Unknown error occurred.'}`,
			);
		} finally {
			setLoading(false);
		}
	}
	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
		};

		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	}, []);
	return (
		<div className="flex min-h-screen items-center justify-center p-4 md:p-8 bg-background">
			<div className="w-full max-w-7xl border p-6 md:p-8 rounded-2xl bg-card shadow-lg">
				<div className="w-full flex flex-col gap-6">
					<div className="flex flex-col md:flex-row items-center justify-between border-b pb-5 gap-4">
						<div className="flex items-center gap-3">
							<div className="relative flex size-10 items-center justify-center rounded-xl bg-primary">
								<Server className="size-5 text-primary-foreground z-10" />
							</div>
							<div className="text-left">
								<h1 className="text-xl font-bold tracking-tight">
									fxManager Setup Console
								</h1>
								<p className="text-xs text-muted-foreground">
									Global deployment environment configuration wizard
								</p>
							</div>
						</div>

						<div className="flex items-center gap-2 text-sm font-medium">
							<span
								className={cn(
									'px-3 py-1.5 rounded-md text-xs font-mono',
									step === 'account'
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground',
								)}
							>
								01_ACCOUNT
							</span>
							<div className="w-3 h-px bg-border" />
							<span
								className={cn(
									'px-3 py-1.5 rounded-md text-xs font-mono',
									step === 'server'
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground',
								)}
							>
								02_ENVIRONMENT
							</span>
							<div className="w-3 h-px bg-border" />
							<span
								className={cn(
									'px-3 py-1.5 rounded-md text-xs font-mono',
									step === 'permissions'
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground',
								)}
							>
								03_PERMISSIONS_GRID
							</span>
							<div className="w-3 h-px bg-border" />
							<span
								className={cn(
									'px-3 py-1.5 rounded-md text-xs font-mono',
									step === 'import'
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground',
								)}
							>
								04_DB_IMPORT
							</span>
						</div>
					</div>

					{step === 'account' && (
						<AccountStep
							formData={formData}
							onChange={handleChange}
							onNext={handleAccountNext}
						/>
					)}

					{step === 'server' && (
						<ServerStep
							formData={formData}
							onChange={handleChange}
							onNext={() => setStep('permissions')}
						/>
					)}

					{step === 'permissions' && (
						<PermissionsStep
							formData={formData}
							loading={loading}
							onAddGroup={(group) =>
								handleChange('adminGroups', [...formData.adminGroups, group])
							}
							onRemoveGroup={(index) =>
								handleChange(
									'adminGroups',
									formData.adminGroups.filter((_, i) => i !== index),
								)
							}
							onBack={() => setStep('server')}
							onSubmit={handleFinalSubmit}
						/>
					)}

					{step === 'import' && (
						<ImportStep onFinish={() => (window.location.href = '/')} />
					)}
				</div>
			</div>
		</div>
	);
}
