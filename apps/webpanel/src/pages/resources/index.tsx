import { PageHeader } from '@/components/page-header';
import { useServerStateSocket } from '@/hooks/ws-channels';
import { useResourcelistSocket } from '@/hooks/ws-channels/use-resourcelist';
import { QueryService } from '@/lib/query';
import { Badge } from '@fxmanager/ui/components/badge';
import { Button } from '@fxmanager/ui/components/button';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { Skeleton } from '@fxmanager/ui/components/skeleton';
import { cn } from '@fxmanager/ui/lib/utils';
import {
	LayoutList,
	Package,
	User,
	Play,
	Square,
	AlertCircle,
	RefreshCcwIcon,
} from 'lucide-react';
import { toast } from 'sonner';

function formatPath(path: string): string {
	const normalized = path.replace(/\\/g, '/');

	const parts = normalized.split(/\/resources\/+/i);
	if (parts.length > 1) {
		return parts[parts.length - 1];
	}

	return normalized;
}

function ResourceCardSkeleton() {
	return (
		<div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg">
			<div className="flex items-start justify-between">
				<div className="space-y-2 w-full">
					<div className="flex items-center gap-2">
						<Skeleton className="h-4 w-4 rounded" />
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-12 rounded" />
					</div>

					<Skeleton className="h-3 w-3/4" />
					<Skeleton className="h-3 w-2/3" />

					<div className="flex gap-4 mt-2">
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-3 w-40" />
					</div>
				</div>

				<div className="flex flex-col items-center gap-4 p-2">
					<Skeleton className="h-6 w-24 rounded" />

					<div className="flex gap-2">
						<Skeleton className="h-8 w-8 rounded" />
						<Skeleton className="h-8 w-8 rounded" />
					</div>
				</div>
			</div>
		</div>
	);
}

function LoadingSkeleton({ blur }: { blur?: boolean }) {
	return (
		<div className={blur ? 'grid gap-4 blur-sm' : 'grid gap-4'}>
			{Array.from({ length: 6 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: immutable array
				<ResourceCardSkeleton key={i} />
			))}
		</div>
	);
}

function StateDisplay({ type }: { type: 'stopped' | 'crashed' }) {
	const isCrashed = type === 'crashed';

	return (
		<div>
			<div className="flex flex-row justify-center items-center text-center gap-4 bg-zinc-900 border border-zinc-800 px-8 py-10 rounded-xl">
				<div
					className={`p-4 rounded-full ${
						isCrashed
							? 'bg-red-500/10 text-red-500'
							: 'bg-zinc-700/20 text-zinc-400'
					}`}
				>
					{isCrashed ? <AlertCircle size={28} /> : <Square size={28} />}
				</div>

				<div className="space-y-1 text-start">
					<h3
						className={`text-lg font-semibold ${
							isCrashed ? 'text-red-500' : 'text-zinc-200'
						}`}
					>
						{isCrashed ? 'Server Crashed' : 'Server Stopped'}
					</h3>

					<p className="text-sm text-zinc-400 max-w-sm">
						{isCrashed
							? 'The server process terminated unexpectedly. Check logs for more details.'
							: 'The server is currently offline. Start it to view and manage resources.'}
					</p>
				</div>
			</div>
		</div>
	);
}

export function ResourceList() {
	const { state } = useServerStateSocket();
	const {
		resources,
		loading,
		status: resourceListStatus,
	} = useResourcelistSocket();

	function formatVersion(version: string | null) {
		if (!version) return 'unknown';
		else if (version.startsWith('v')) return version;
		else return `v${version}`;
	}

	async function handleAction(resource: string, action: 'start' | 'stop') {
		try {
			await QueryService({
				endpoint: `/server/resource/action/${action}`,
				method: 'POST',
				body: { resource },
			});
		} catch (err) {
			console.error(
				`Unable to execute action ${action}`,
				(err as Error).message,
			);
			toast.error(`Unable to ${action} for resource ${resource}`, {
				richColors: true,
				position: 'top-center',
			});
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-end">
				<PageHeader
					Icon={LayoutList}
					title="Resource List"
					description="Server resources and controls."
				/>
				<div className="pb-2 text-sm font-medium">
					{resourceListStatus === 'errored' && (
						<span className="flex items-center text-red-500 gap-1">
							<AlertCircle size={16} /> Resource list error
						</span>
					)}
				</div>
			</div>

			<div
				className={cn(
					'h-[calc(100vh-7rem)] rounded-md border border-zinc-800 p-4',
					(loading || state.status !== 'running') && 'overflow-hidden',
				)}
			>
				{loading ? (
					<LoadingSkeleton />
				) : state.status === 'running' ? (
					<ScrollArea className="h-[calc(100vh-8rem)]">
						<div className="grid gap-4">
							{resources.map((res) => (
								<div
									key={res.name}
									className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg hover:bg-zinc-900 transition-colors group"
								>
									<div className="flex items-start justify-between">
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<Package size={18} className="text-blue-400" />
												<h3 className="font-bold text-zinc-100">{res.name}</h3>
												<span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
													{formatVersion(res.version)}
												</span>
											</div>

											<p className="text-sm text-zinc-400 leading-relaxed">
												{res.description ||
													'No description provided for this resource.'}
											</p>

											<div className="flex gap-4 mt-2 text-xs text-zinc-500">
												{res.author && (
													<span className="flex items-center gap-1">
														<User size={12} /> {res.author}
													</span>
												)}
												<span className="font-mono">
													{formatPath(res.path)}
												</span>
											</div>
										</div>

										<div className="flex flex-col items-center justify-between gap-4 p-2">
											<Badge
												variant={
													res.status === 'started' ? 'success' : 'secondary'
												}
												className="w-[6.5rem] flex items-center justify-center gap-2 capitalize py-1"
											>
												{res.status === 'started' ? (
													<Play size={12} fill="currentColor" />
												) : (
													<Square size={12} fill="currentColor" />
												)}
												{res.status}
											</Badge>

											<div className="flex gap-2">
												{res.status === 'stopped' ? (
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 bg-green-500/20 disabled:bg-transparent hover:text-green-500"
														title="Start Resource"
														onClick={() => handleAction(res.name, 'start')}
													>
														<Play size={16} />
													</Button>
												) : (
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 bg-blue-500/20 disabled:bg-transparent hover:text-blue-500"
														title="Restart Resource"
														onClick={() => handleAction(res.name, 'start')}
													>
														<RefreshCcwIcon size={16} />
													</Button>
												)}

												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 bg-red-500/20 disabled:bg-transparent hover:text-red-500"
													disabled={res.status === 'stopped'}
													title="Stop Resource"
													onClick={() => handleAction(res.name, 'stop')}
												>
													<Square size={16} />
												</Button>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
				) : (
					<div className="relative overflow-hidden">
						<LoadingSkeleton blur />
						<div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
							<div className="pointer-events-auto">
								<StateDisplay
									type={state.status === 'crashed' ? 'crashed' : 'stopped'}
								/>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
