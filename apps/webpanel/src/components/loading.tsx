import { Spinner } from '@fxmanager/ui/components/spinner';

export function Loading({ message }: { message?: string }) {
	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background text-foreground">
			{/* <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(0.555_0.163_48.998/0.14),transparent_38%),radial-gradient(circle_at_bottom_right,oklch(0.705_0.015_286.067/0.18),transparent_34%)] dark:bg-[radial-gradient(circle_at_top,oklch(0.473_0.137_46.201/0.2),transparent_38%),radial-gradient(circle_at_bottom_right,oklch(0.552_0.016_285.938/0.16),transparent_34%)]" /> */}
			{/* <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,transparent,oklch(0.21_0.006_285.885/0.04),transparent)] dark:bg-[linear-gradient(to_bottom_right,transparent,oklch(0.985_0_0/0.04),transparent)]" /> */}

			<div className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border bg-card px-8 py-10 shadow-2xl">
				<Spinner className="size-15 text-primary" />
				<div className="space-y-1 text-center">
					<p className="text-md font-medium tracking-wide text-foreground">
						Loading fxManager
					</p>
					<p className="text-sm text-muted-foreground">{message}</p>
				</div>
			</div>
		</div>
	);
}
