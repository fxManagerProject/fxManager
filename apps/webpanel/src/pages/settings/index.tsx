import { RefreshCcw, Settings } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@fxmanager/ui/components/tabs';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import GeneralTab from './tabs/general';
import { useCallback, useEffect, useState } from 'react';
import FXServerTab from './tabs/fxserver';
import WhitelistTab from './tabs/whitelist';
import RestartsTab from './tabs/restarts';
import { QueryService } from '@/lib/query';
import type {
	ApiResponse,
	SettingsKey,
	SettingsScope,
} from '@fxmanager/shared/types';
import { Spinner } from '@fxmanager/ui/components/spinner';
import { Button } from '@fxmanager/ui/components/button';
import { cn } from '@fxmanager/ui/lib/utils';
import { Skeleton } from '@fxmanager/ui/components/skeleton';
import type { SettingsTabProps } from '@/types/settings';
import { toast } from 'sonner';

interface Tab {
	value: SettingsScope;
	label: string;
	description: string;
	component: React.FC<SettingsTabProps<SettingsScope>>;
}

const TABS = [
	{
		value: 'general',
		label: 'General',
		description: 'General configuration options for fxManager.',
		component: GeneralTab,
	},
	{
		value: 'fxserver',
		label: 'FXServer',
		description: 'Paths and runtime behaviour of the FXServer instance.',
		component: FXServerTab,
	},
	{
		value: 'whitelist',
		label: 'Whitelist',
		description: 'Control who is allowed to join the server.',
		component: WhitelistTab,
	},
	{
		value: 'restarts',
		label: 'Restarts',
		description: 'Schedule automatic server restarts and warn players.',
		component: RestartsTab,
	},
] satisfies Tab[];

type SettingsCache = {
	[S in SettingsScope]?: Partial<Record<SettingsKey<S>, string>>;
};

export default function SettingsPage() {
	const [currentTab, setCurrentTab] = useState<string>(TABS[0].value);
	const [loading, setLoading] = useState(true);
	const [disabled, setDisabled] = useState(false);
	const [cache, setCache] = useState<SettingsCache>({});

	const loadTab = useCallback(
		async (tab: string, useCache = true) => {
			if (tab in cache && useCache) return;

			setLoading(true);

			try {
				const response = await QueryService<ApiResponse<SettingsCache>>({
					endpoint: `/settings/${tab}`,
					method: 'GET',
				});

				if (response.success) {
					setCache((prev) => ({ ...prev, [tab]: response.data }));
				}
			} catch {
				toast.error('Failed to load settings.');
			} finally {
				setLoading(false);
			}
		},
		[cache],
	);

	async function updateSettings<S extends SettingsScope>(
		scope: S,
		key: SettingsKey<S>,
		value: string,
	) {
		const previousValue = cache[scope]?.[key];

		setCache((prev) => ({
			...prev,
			[scope]: {
				...prev[scope],
				[key]: value,
			},
		}));

		setDisabled(true);

		try {
			const response = await QueryService<ApiResponse>({
				endpoint: `/settings/${scope}`,
				method: 'POST',
				body: { key, value },
			});

			if (!response.success) {
				setCache((prev) => ({
					...prev,
					[scope]: {
						...prev[scope],
						[key]: previousValue,
					},
				}));
			}
		} catch {
			toast.error(`Failed to update setting.`);

			setCache((prev) => ({
				...prev,
				[scope]: {
					...prev[scope],
					[key]: previousValue,
				},
			}));
		}

		setDisabled(false);
	}

	useEffect(() => {
		void loadTab(currentTab);
	}, [currentTab, loadTab]);

	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<PageHeader
				Icon={Settings}
				title="Settings"
				description="Configuration options for fxManager."
			/>

			<Tabs
				value={currentTab}
				className="flex-1 overflow-hidden"
				onValueChange={(tab) => {
					setCurrentTab(tab);
				}}
			>
				<TabsList className="justify-start flex-wrap h-auto">
					{TABS.map(({ value, label }) => (
						<TabsTrigger key={value} value={value}>
							{label}
						</TabsTrigger>
					))}
				</TabsList>

				<ScrollArea className="h-[calc(100vh-12rem)]">
					{TABS.map(({ value, label, description, component: Component }) => (
						<TabsContent key={value} value={value}>
							<Card>
								<CardHeader className="gap-0.5">
									<div className="flex items-start justify-between gap-4">
										<div>
											<CardTitle className="text-2xl text-neutral-700 dark:text-neutral-200">
												{label}
											</CardTitle>
											<CardDescription>{description}</CardDescription>
										</div>

										<Button
											disabled={loading}
											variant="secondary"
											onClick={() => loadTab(value, false)}
										>
											<RefreshCcw /> Refresh Tab
										</Button>
									</div>
								</CardHeader>

								<CardContent className="relative">
									<div
										className={cn(
											'transition-all',
											loading &&
												currentTab === value &&
												'blur-sm pointer-events-none',
										)}
									>
										{loading || !cache[value as keyof typeof cache] ? (
											<div className="space-y-4">
												<Skeleton className="h-10 w-full" />
												<Skeleton className="h-10 w-full" />
												<Skeleton className="h-10 w-2/3" />
											</div>
										) : (
											<Component
												data={cache[value as keyof typeof cache] ?? {}}
												onChange={(key, newValue) =>
													updateSettings(value, key, newValue)
												}
												disabled={disabled}
											/>
										)}
									</div>

									{loading && currentTab === value && (
										<div className="absolute inset-0 flex items-center justify-center">
											<Spinner className="size-10" />
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>
					))}
				</ScrollArea>
			</Tabs>
		</div>
	);
}
