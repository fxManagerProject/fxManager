import { PageHeader } from '@/components/page-header';
import { useServerStateSocket } from '@/hooks/ws-channels';
import { useResourcelistSocket } from '@/hooks/ws-channels/use-resourcelist';
import { QueryService } from '@/lib/query';
import type { ResourceData } from '@fxmanager/shared/types';
import { Badge } from '@fxmanager/ui/components/badge';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
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
	FileQuestionMark,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type FilterValue = 'all' | 'started' | 'stopped';

function formatPath(path: string): string {
	const normalized = path.replace(/\\/g, '/');

	const parts = normalized.split(/\/resources\/+/i);
	if (parts.length > 1) {
		return parts[parts.length - 1];
	}

	return normalized;
}

function ResourceCardSkeleton() {
	const skeletonBg = 'bg-zinc-300 dark:bg-zinc-800/80';
	return (
		<div className="bg-zinc-300/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 p-4 rounded-lg animate-pulse">
			<div className="flex items-start justify-between">
				<div className="space-y-2 w-full">
					<div className="flex items-center gap-2">
						<Skeleton className={`h-4 w-4 rounded ${skeletonBg}`} />
						<Skeleton className={`h-4 w-32 ${skeletonBg}`} />
						<Skeleton className={`h-4 w-12 rounded ${skeletonBg}`} />
					</div>

					<Skeleton className={`h-3 w-3/4 ${skeletonBg}`} />
					<Skeleton className={`h-3 w-2/3 ${skeletonBg}`} />

					<div className="flex gap-4 mt-2">
						<Skeleton className={`h-3 w-24 ${skeletonBg}`} />
						<Skeleton className={`h-3 w-40 ${skeletonBg}`} />
					</div>
				</div>

				<div className="flex flex-col items-center gap-4 p-2">
					<Skeleton className={`h-6 w-24 rounded ${skeletonBg}`} />

					<div className="flex gap-2">
						<Skeleton className={`h-8 w-8 rounded ${skeletonBg}`} />
						<Skeleton className={`h-8 w-8 rounded ${skeletonBg}`} />
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

const STATE_CONFIG = {
	stopped: {
		icon: Square,
		title: 'Server Stopped',
		description:
			'The server is currently offline. Start it to view and manage resources.',
		styles: 'bg-zinc-200 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400',
		titleStyle: 'text-zinc-900 dark:text-zinc-200',
	},
	crashed: {
		icon: AlertCircle,
		title: 'Server Crashed',
		description:
			'The server process terminated unexpectedly. Check logs for more details.',
		styles: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500',
		titleStyle: 'text-red-600 dark:text-red-500',
	},
	no_resources: {
		icon: FileQuestionMark,
		title: 'No Resources',
		description: 'No resources were found on the server.',
		styles: 'bg-zinc-200 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400',
		titleStyle: 'text-zinc-900 dark:text-zinc-200',
	},
} as const;

function StateDisplay({ type }: { type: keyof typeof STATE_CONFIG }) {
	const config = STATE_CONFIG[type];
	const Icon = config.icon;

	return (
		<div className="flex flex-row justify-center items-center text-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-8 py-10 rounded-xl shadow-sm dark:shadow-none">
			<div className={`p-4 rounded-full ${config.styles}`}>
				<Icon size={28} />
			</div>

			<div className="space-y-1 text-start">
				<h3 className={`text-lg font-semibold ${config.titleStyle}`}>
					{config.title}
				</h3>
				<p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
					{config.description}
				</p>
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
	const [displayedResources, setDisplayedResources] =
		useState<ResourceData[]>(resources);
	const [searchValue, setSearchValue] = useState<string>('');
	const [filterValue, setFilterValue] = useState<FilterValue>('all');
	const [refreshing, setRefresh] = useState<boolean>(false);

	useEffect(() => {
		const filtered = resources.filter((res) => {
			const matchesSearch =
				searchValue.trim() === '' ||
				res.name.toLowerCase().includes(searchValue.toLowerCase());

			const matchesStatus = filterValue === 'all' || res.status === filterValue;

			return matchesSearch && matchesStatus;
		});

		setDisplayedResources(filtered);
	}, [resources, searchValue, filterValue]);

	function handleSearch({ target }: React.ChangeEvent<HTMLInputElement>) {
		const { value } = target;
		setSearchValue(value);
	}

	function formatVersion(version: string) {
		if (version.startsWith('v')) return version;
		return `v${version}`;
	}

	async function handleAction(
		action: 'start' | 'stop' | 'refresh',
		resource?: string,
	) {
		if (state.status !== 'running') {
			toast.error('Server is not running');
			return;
		}

		if (action === 'refresh') {
			if (refreshing) {
				toast.warning('Refresh already ongoing');
				return;
			}

			setRefresh(true);
		}

		try {
			await QueryService({
				endpoint: `/resources/action/${action}`,
				method: 'POST',
				...(resource && { body: { resource } }),
			});
		} catch (err) {
			console.error(
				`Unable to execute action ${action}`,
				(err as Error).message,
			);

			toast.error(
				action === 'refresh'
					? 'Unable to refresh resource list'
					: `Unable to ${action} resource ${resource}`,
			);
		} finally {
			setRefresh(false);
		}
	}

	return (
		<div className="space-y-4 text-zinc-900 dark:text-zinc-50">
			<div className="flex justify-between items-end">
				<PageHeader
					Icon={LayoutList}
					title="Resource List"
					description="Server resources and controls."
				/>
				<div className="pb-2 text-sm font-medium">
					{resourceListStatus === 'errored' && (
						<span className="flex items-center text-red-600 dark:text-red-500 gap-1">
							<AlertCircle size={16} /> Resource list error
						</span>
					)}
				</div>
			</div>

			<div className="w-full border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 p-4">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
						<Input
							type="text"
							onChange={handleSearch}
							disabled={state.status !== 'running'}
							placeholder="Search resources..."
							className="sm:w-64 bg-white dark:bg-zinc-950"
						/>

						<Select
							onValueChange={(v) => setFilterValue(v as FilterValue)}
							disabled={state.status !== 'running'}
						>
							<SelectTrigger className="w-full sm:w-[160px] bg-white dark:bg-zinc-950">
								<SelectValue placeholder="Filter status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="started">Started</SelectItem>
								<SelectItem value="stopped">Stopped</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
						{state.status === 'running' && (
							<div className="flex items-center gap-6 text-sm">
								<div className="flex flex-col items-center">
									<span className="text-zinc-500 dark:text-zinc-400">
										Total
									</span>
									<span className="font-semibold text-zinc-900 dark:text-zinc-100">
										{resources.length}
									</span>
								</div>

								<div className="flex flex-col items-center">
									<span className="text-green-600 dark:text-green-400">
										Started
									</span>
									<span className="font-semibold text-zinc-900 dark:text-zinc-100">
										{resources.filter((res) => res.status === 'started').length}
									</span>
								</div>

								<div className="flex flex-col items-center">
									<span className="text-red-600 dark:text-red-400">
										Stopped
									</span>
									<span className="font-semibold text-zinc-900 dark:text-zinc-100">
										{resources.filter((res) => res.status === 'stopped').length}
									</span>
								</div>
							</div>
						)}

						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 bg-zinc-200/60 hover:bg-zinc-300 dark:bg-zinc-800/60 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
							onClick={() => handleAction('refresh')}
							disabled={state.status !== 'running'}
							title="Refresh resources"
						>
							<RefreshCcwIcon
								className={cn('h-4 w-4', refreshing && 'animate-spin')}
							/>
						</Button>
					</div>
				</div>
			</div>

			<div
				className={cn(
					'h-[calc(100vh-13rem)] rounded-md border border-zinc-200 dark:border-zinc-800 p-4 pr-1',
					(loading || state.status !== 'running') && 'overflow-hidden',
				)}
			>
				{loading || state.status === 'starting' ? (
					<LoadingSkeleton />
				) : state.status === 'running' ? (
					<ScrollArea className="h-[calc(100vh-15rem)] pr-3">
						<div className="grid gap-4">
							{displayedResources.length > 0 ? (
								displayedResources.map((res) => (
									<div
										key={res.name}
										className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-4 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group"
									>
										<div className="flex items-start justify-between">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<Package
														size={18}
														className="text-blue-600 dark:text-blue-400"
													/>
													<h3 className="font-bold text-zinc-900 dark:text-zinc-100">
														{res.name}
													</h3>
													{res.version && (
														<span className="text-xs bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
															{formatVersion(res.version)}
														</span>
													)}
												</div>

												<p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
													{res.description ||
														'No description provided for this resource.'}
												</p>

												<div className="flex gap-4 mt-2 text-xs text-zinc-500 dark:text-zinc-500">
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
															className="h-8 w-8 bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 disabled:bg-transparent hover:text-green-600 dark:hover:text-green-500"
															title="Start Resource"
															onClick={() => handleAction('start', res.name)}
														>
															<Play size={16} />
														</Button>
													) : (
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8 bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 disabled:bg-transparent hover:text-blue-600 dark:hover:text-blue-500"
															title="Restart Resource"
															onClick={() => handleAction('start', res.name)}
														>
															<RefreshCcwIcon size={16} />
														</Button>
													)}

													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 disabled:bg-transparent hover:text-red-600 dark:hover:text-red-500"
														disabled={res.status === 'stopped'}
														title="Stop Resource"
														onClick={() => handleAction('stop', res.name)}
													>
														<Square size={16} />
													</Button>
												</div>
											</div>
										</div>
									</div>
								))
							) : (
								<StateDisplay type={'no_resources'} />
							)}
						</div>
					</ScrollArea>
				) : (
					<div className="relative overflow-hidden h-[calc(100vh-15rem)] pr-3">
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
