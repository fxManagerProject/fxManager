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
	CardFooter,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import GeneralTab from './tabs/general';
import { useCallback, useEffect, useState } from 'react';
import FXServerTab from './tabs/fxserver';
import WhitelistTab from './tabs/whitelist';
import { QueryService } from '@/lib/query';
import type { ApiResponse } from '@fxmanager/shared/types';
import { Spinner } from '@fxmanager/ui/components/spinner';
import { Button } from '@fxmanager/ui/components/button';
import { cn } from '@fxmanager/ui/lib/utils';

const TABS = [
	{
		value: 'general',
		label: 'General',
		description: 'General configuration options for fxManager.',
		component: <GeneralTab />,
	},
	{
		value: 'fxserver',
		label: 'FXServer',
		description: 'Paths and runtime behaviour of the FXServer instance.',
		component: <FXServerTab />,
	},
	{
		value: 'whitelist',
		label: 'Whitelist',
		description: 'Control who is allowed to join the server.',
		component: <WhitelistTab />,
	},
];

export default function SettingsPage() {
	const [currentTab, setCurrentTab] = useState<string>(TABS[0].value);
	const [loading, setLoading] = useState(true);
	const [cache, setCache] = useState<Record<string, string | number | boolean>>(
		{},
	);

	const loadTab = useCallback(
		async (tab: string, useCache = true) => {
			if (tab in cache && useCache) return;

			setLoading(true);

			const response = await QueryService<ApiResponse>({
				endpoint: `/settings/${tab}`,
				method: 'GET',
			});

			setCache((prev) => ({ ...prev, [tab]: response.success }));
			setLoading(false);
		},
		[cache],
	);

	useEffect(() => {
		void loadTab(currentTab);
	}, [currentTab, loadTab]);

	return (
		<div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
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
					{TABS.map(({ value, label, description, component }) => (
						<TabsContent key={value} value={value}>
							<Card>
								<CardHeader className="gap-0.5">
									<CardTitle className="text-2xl dark:text-neutral-200 text-neutral-700">
										{label}
									</CardTitle>
									<CardDescription>{description}</CardDescription>
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
										{component}
									</div>

									{loading && currentTab === value && (
										<div className="absolute inset-0 flex items-center justify-center">
											<Spinner className="size-10" />
										</div>
									)}
								</CardContent>

								<CardFooter className="ml-auto">
									<Button
										disabled={loading}
										variant="secondary"
										onClick={() => loadTab(value, false)}
									>
										<RefreshCcw /> Refresh Tab
									</Button>
								</CardFooter>
							</Card>
						</TabsContent>
					))}
				</ScrollArea>
			</Tabs>
		</div>
	);
}
