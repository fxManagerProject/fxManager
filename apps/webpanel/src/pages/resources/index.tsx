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
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@fxmanager/ui/components/collapsible';
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
	Plus,
	Minus,
	ChevronsUpDown,
	FolderIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@fxmanager/ui/components/tooltip';

type FilterValue = 'all' | 'started' | 'stopped';

type ResourceGroupType = {
	resources: ResourceData[];
	[key: string]: ResourceData[] | ResourceGroupType;
};

const REGEX_RESOURCE_GROUPS = /\[([^\]]+)\]/g;

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

function formatVersion(version: string) {
	if (version.startsWith('v')) return version;
	return `v${version}`;
}

function ResourceCard({
	resource,
	handleAction,
}: {
	resource: ResourceData;
	handleAction: (
		action: 'start' | 'stop' | 'refresh',
		resource?: string | undefined,
	) => void;
}) {
	const isStarted = resource.status === 'started';

	return (
		<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 px-3 py-2.5 rounded-md hover:bg-zinc-100/80 dark:hover:bg-zinc-900 transition-colors group">
			<div className="flex items-center gap-3 min-w-0 flex-1">
				<div
					className={cn(
						'p-1.5 rounded-md shrink-0',
						isStarted
							? 'bg-green-500/10 text-green-600 dark:text-green-400'
							: 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500',
					)}
				>
					<Package size={16} />
				</div>

				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
							{resource.name}
						</h3>
						{resource.version && (
							<span className="text-[10px] font-mono bg-zinc-200/70 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
								{formatVersion(resource.version)}
							</span>
						)}
						{resource.author && (
							<span className="text-xs text-zinc-400 dark:text-zinc-500 hidden lg:flex items-center gap-1">
								<User size={10} /> {resource.author}
							</span>
						)}
					</div>

					{resource.description && (
						<p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-xl">
							{resource.description}
						</p>
					)}
				</div>
			</div>

			<div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-200 dark:border-zinc-800">
				<Badge
					variant={isStarted ? 'success' : 'secondary'}
					className="h-6 px-2 text-[11px] font-medium capitalize flex items-center gap-1.5 shrink-0"
				>
					{isStarted ? (
						<Play size={10} className="fill-current" />
					) : (
						<Square size={10} className="fill-current" />
					)}
					{resource.status}
				</Badge>

				<div className="flex items-center gap-1 bg-zinc-200/50 dark:bg-zinc-800/50 p-0.5 rounded-md border border-zinc-200/80 dark:border-zinc-800">
					{isStarted ? (
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-blue-600 dark:text-blue-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
							title="Restart Resource"
							onClick={() => handleAction('start', resource.name)}
						>
							<RefreshCcwIcon size={14} />
						</Button>
					) : (
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-green-600 dark:text-green-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
							title="Start Resource"
							onClick={() => handleAction('start', resource.name)}
						>
							<Play size={14} />
						</Button>
					)}

					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 text-red-600 dark:text-red-400 disabled:opacity-30 hover:bg-zinc-200 dark:hover:bg-zinc-700"
						disabled={!isStarted}
						title="Stop Resource"
						onClick={() => handleAction('stop', resource.name)}
					>
						<Square size={14} />
					</Button>
				</div>
			</div>
		</div>
	);
}

function ResourceGroup({
	name,
	node,
	rootElement,
	handleAction,
	globalExpand,
}: {
	name: string;
	node: ResourceGroupType;
	rootElement?: boolean;
	handleAction: (
		action: 'start' | 'stop' | 'refresh',
		resource?: string | undefined,
	) => void;
	globalExpand: boolean | null;
}) {
	const [collapsed, setCollapsed] = useState<boolean>(false);

	// Synchronize with global expand/collapse toggle changes
	useEffect(() => {
		if (globalExpand !== null) {
			setCollapsed(!globalExpand);
		}
	}, [globalExpand]);

	const { resources, ...subcategories } = node;
	const totalResources = resources?.length || 0;

	return (
		<div className="my-1">
			<Collapsible
				open={!collapsed}
				onOpenChange={(open) => setCollapsed(!open)}
			>
				<CollapsibleTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="w-full h-8 px-2 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800/60 rounded-md transition-colors my-1 group"
					>
						<div className="flex items-center gap-2">
							<FolderIcon />
							<span className="font-semibold text-xs tracking-wider uppercase text-zinc-600 dark:text-zinc-400">
								{name}
							</span>
							<span className="text-[10px] font-mono bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.2 rounded-full">
								{totalResources}
							</span>
						</div>
						{collapsed ? (
							<Plus className="h-3.5 w-3.5 text-zinc-400" />
						) : (
							<Minus className="h-3.5 w-3.5 text-zinc-400" />
						)}
					</Button>
				</CollapsibleTrigger>

				<CollapsibleContent className="overflow-hidden data-[state=open]:animate-slide-down data-[state=closed]:animate-slide-up">
					<div className="pl-3 ml-2.5 border-l border-zinc-200 dark:border-zinc-800 space-y-1.5 py-1">
						{resources && resources.length > 0 && (
							<div className="flex flex-col gap-1.5">
								{[...resources]
									.sort((a, b) => a.name.localeCompare(b.name))
									.map((res) => (
										<ResourceCard
											key={res.name}
											resource={res}
											handleAction={handleAction}
										/>
									))}
							</div>
						)}

						{resources && resources.length === 0 && !rootElement && (
							<div className="text-xs text-zinc-400 p-2 italic bg-zinc-50/50 dark:bg-zinc-900/20 rounded border border-dash border-zinc-200 dark:border-zinc-800">
								No resources in this group
							</div>
						)}

						{Object.entries(subcategories).map(([subName, subNode]) => (
							<ResourceGroup
								key={subName}
								name={subName}
								node={subNode as ResourceGroupType}
								handleAction={handleAction}
								globalExpand={globalExpand}
							/>
						))}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

function ResourceCardSkeleton() {
	const skeletonBg = 'bg-zinc-300 dark:bg-zinc-800/80';
	return (
		<div className="bg-zinc-300/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 p-4 mr-2 rounded-lg animate-pulse">
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
	const [globalExpand, setGlobalExpand] = useState<boolean | null>(null);

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

	const resourceGroups = useMemo(() => {
		return displayedResources.reduce(
			(acc, cur) => {
				const groups = [...cur.path.matchAll(REGEX_RESOURCE_GROUPS)]
					.map((match) => match[1])
					.filter((i) => typeof i === 'string');

				let location;
				if (groups.length > 0 && groups[0] !== undefined) {
					location = acc.other;
					for (const grp of groups) {
						if (!Object.hasOwn(location, grp)) {
							location[grp] = { resources: [] };
						}
						location = location[grp];
					}
					location = location.resources;
				} else {
					location = acc.root;
				}

				location.push(cur);

				return acc;
			},
			{
				root: [] as ResourceData[],
				other: {} as Record<string, any>,
			},
		);
	}, [displayedResources]);

	return (
		<div className="flex flex-col gap-4 text-zinc-900 dark:text-zinc-50 h-full p-4">
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

					<div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
						{state.status === 'running' && (
							<div className="flex items-center gap-6 text-sm mr-2">
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

						<Tooltip>
							<TooltipTrigger>
								<Button
									variant="outline"
									size="sm"
									className="h-9 gap-1.5 bg-white dark:bg-zinc-950 text-xs font-medium"
									onClick={() => setGlobalExpand((prev) => !prev)}
									disabled={state.status !== 'running'}
									title="Expand / Collapse All"
								>
									<ChevronsUpDown className="h-4 w-4" />
									<span>Toggle All</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								Collapse / Expand all resource folders
							</TooltipContent>
						</Tooltip>

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
					'flex-1 flex flex-col min-h-0 rounded-md border border-zinc-200 dark:border-zinc-800 p-4 pr-1',
					(loading || state.status !== 'running') && 'overflow-hidden',
				)}
			>
				{loading || state.status === 'starting' ? (
					<LoadingSkeleton />
				) : state.status === 'running' ? (
					<ScrollArea className="h-full pr-3">
						<div className="grid gap-2">
							{resourceGroups.root.length > 0 && (
								<ResourceGroup
									node={{ resources: resourceGroups.root }}
									name="root"
									rootElement
									handleAction={handleAction}
									globalExpand={globalExpand}
								/>
							)}
							{Object.entries(resourceGroups.other).map(([name, node]) => (
								<ResourceGroup
									key={name}
									name={name}
									node={node}
									rootElement
									handleAction={handleAction}
									globalExpand={globalExpand}
								/>
							))}
						</div>
					</ScrollArea>
				) : (
					<div className="relative overflow-hidden h-full pr-3">
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
