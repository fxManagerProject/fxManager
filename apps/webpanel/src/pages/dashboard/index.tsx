import {
	Activity,
	Clock,
	Flag,
	LayoutDashboard,
	Shield,
	User,
} from 'lucide-react';
import { formatDuration, formatRemaining, isServerRunning } from '@/lib/utils';
import { STATUS_VARIANT } from '@/static/server-state';
import { PageHeader } from '@/components/page-header';
import { usePlayerlistSocket, useServerStateSocket } from '@/hooks/ws-channels';
import { usePerfSocket } from '@/hooks/ws-channels/use-perf';
import { Badge } from '@fxmanager/ui/components/badge';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import { useSchedule } from '@/hooks/use-schedule';
import { useEffect, useMemo, useState } from 'react';
import { ScrollArea, ScrollBar } from '@fxmanager/ui/components/scroll-area';
import {
	Area,
	AreaChart,
	CartesianGrid,
	ChartContainer,
	ChartTooltip,
	XAxis,
	YAxis,
	type ChartConfig,
	type TooltipContentProps,
} from '@fxmanager/ui/components/chart';

const clockFmt = new Intl.DateTimeFormat([], {
	hour: '2-digit',
	minute: '2-digit',
});

const chartConfig = {
	players: {
		color: 'var(--chart-2)',
	},
} satisfies ChartConfig;

function pingColor(ping?: number): string {
	if (ping === undefined) return 'text-zinc-500';
	if (ping < 80) return 'text-emerald-400';
	if (ping < 150) return 'text-yellow-400';
	return 'text-red-500';
}

function PlayerTooltip({ active, payload, label }: TooltipContentProps) {
	const playerPayload = payload?.find((p) => p.dataKey === 'players');
	const isVisible = active && playerPayload?.value !== undefined;

	if (!isVisible) return null;

	return (
		<div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-sm">
			<span className="text-muted-foreground">{label}</span>
			<span className="mx-1.5 text-border">|</span>
			<span className="font-bold">{playerPayload.value} players</span>
		</div>
	);
}

export default function DashboardPage() {
	const { state: serverState } = useServerStateSocket();
	const { status: schedule } = useSchedule();
	const { players: rawPlayers } = usePlayerlistSocket();
	const { samples } = usePerfSocket();

	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const status = serverState?.status ?? 'stopped';
	const nextRestartMs = schedule?.nextRestart
		? new Date(schedule.nextRestart).getTime() - now
		: null;
	const uptimeMs =
		isServerRunning(status) && serverState.startedAt
			? now - new Date(serverState.startedAt).getTime()
			: null;

	const staffData = useMemo(() => {
		const connectedStaff = rawPlayers.filter((p) => p.isStaff);
		return {
			list: connectedStaff,
			count: connectedStaff.length,
		};
	}, [rawPlayers]);

	const chartData = useMemo(
		() =>
			samples.map((s) => ({ time: clockFmt.format(s.ts), players: s.players })),
		[samples],
	);

	const stats = [
		{
			label: 'Status',
			value: (
				<Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>
			),
			icon: Activity,
		},
		{
			label: 'Uptime',
			value: uptimeMs ? formatDuration(uptimeMs, true) : '—',
			icon: Clock,
		},
		{
			label: 'Next Restart',
			value: nextRestartMs ? formatRemaining(nextRestartMs) : '—',
			icon: Clock,
		},
		{
			label: 'Connected Staff',
			value: status === 'running' ? staffData.count : '—',
			icon: Shield,
		},
		{
			label: 'Connected Players',
			value: status === 'running' ? rawPlayers.length : '—',
			icon: User,
		},
	];

	return (
		<ScrollArea className="h-screen overflow-auto pr-2 pb-2">
			<div className="space-y-6">
				<PageHeader
					Icon={LayoutDashboard}
					title="Dashboard"
					description="Server overview."
				/>

				{/* Stat Cards */}
				<ScrollArea className="w-full whitespace-nowrap rounded-md sm:overflow-visible">
					<div className="flex gap-4 p-1 pr-2 pb-3 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:p-1 sm:overflow-visible">
						{stats.map(({ label, value, icon: Icon }) => (
							<Card
								key={label}
								className="bg-card/50 flex flex-col justify-between min-h-[100px] min-w-[180px] max-w-[240px] shrink-0 sm:min-w-0 sm:max-w-none transition-all hover:bg-card/80"
							>
								<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1 pt-3">
									<CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
										{label}
									</CardTitle>
									<Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 ml-2" />
								</CardHeader>

								<CardContent className="pb-3 pt-1 flex items-end grow">
									<div className="text-xl font-bold tracking-tight text-card-foreground leading-none whitespace-normal">
										{value}
									</div>
								</CardContent>
							</Card>
						))}
					</div>

					<ScrollBar orientation="horizontal" className="sm:hidden" />
				</ScrollArea>

				<div className="grid gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2 space-y-6">
						<Card className="bg-card/50 min-h-[350px] w-full">
							<CardHeader>
								<CardTitle>Player List</CardTitle>
							</CardHeader>
							<CardContent className="pb-4">
								{chartData.length === 0 ? (
									<div className="flex h-[30em] items-center justify-center text-sm text-muted-foreground">
										{status === 'running'
											? 'Collecting player samples…'
											: 'No player data — server is offline'}
									</div>
								) : (
									<ChartContainer
										config={chartConfig}
										className="h-[30em] w-full"
									>
										<AreaChart
											accessibilityLayer
											data={chartData}
											margin={{
												top: 10,
											}}
										>
											<CartesianGrid
												vertical={false}
												className="stroke-muted/30"
											/>
											<XAxis
												dataKey="time"
												tickLine={false}
												axisLine={false}
												tickMargin={8}
												interval="preserveStartEnd"
												minTickGap={40}
											/>
											<YAxis
												dataKey="players"
												tickLine={false}
												axisLine={false}
												allowDecimals={false}
											/>
											<ChartTooltip cursor={false} content={PlayerTooltip} />
											<defs>
												<linearGradient
													id="fillPlayers"
													x1="0"
													y1="0"
													x2="0"
													y2="1"
												>
													<stop
														offset="5%"
														stopColor="var(--color-players)"
														stopOpacity={0.4}
													/>
													<stop
														offset="95%"
														stopColor="var(--color-players)"
														stopOpacity={0.0}
													/>
												</linearGradient>
											</defs>
											<Area
												dataKey="players"
												type="monotone"
												fill="url(#fillPlayers)"
												stroke="var(--color-players)"
												strokeWidth={2}
												stackId="a"
											/>
										</AreaChart>
									</ChartContainer>
								)}
							</CardContent>
						</Card>
					</div>

					<div className="lg:col-span-1">
						<Card className="bg-card/50 flex flex-col h-full">
							<CardHeader>
								<CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
									<Shield className="h-4 w-4 text-primary" />
									Connected Admins
								</CardTitle>
								<CardDescription>
									Active staff members currently managing the server.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex-1">
								{status !== 'running' ? (
									<div className="text-sm text-muted-foreground py-4 text-center">
										Server is offline
									</div>
								) : staffData.list.length === 0 ? (
									<div className="text-sm text-muted-foreground py-4 text-center">
										No staff currently online
									</div>
								) : (
									<ul className="divide-y divide-border/50">
										{staffData.list.map((admin) => (
											<li
												key={admin.id}
												className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
											>
												<div className="flex flex-col">
													<span className="text-sm font-medium leading-none">
														({admin.serverId}) {admin.name}
													</span>
												</div>
												<div className="flex items-center gap-3">
													{admin.ping !== undefined && (
														<span
															className={`text-xs ${pingColor(admin.ping)}`}
														>
															{admin.ping}ms
														</span>
													)}
												</div>
											</li>
										))}
									</ul>
								)}
							</CardContent>
						</Card>
					</div>
				</div>

				<Card className="bg-card/50">
					<CardHeader>
						<CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
							<Flag className="h-4 w-4 text-primary" />
							Active Reports
							<Badge
								variant="outline"
								className="ml-1 text-[10px] uppercase tracking-wide"
							>
								WIP
							</Badge>
						</CardTitle>
						<CardDescription>
							Live player reports awaiting staff review.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
							<Flag className="h-6 w-6 text-muted-foreground/40" />
							<p className="text-sm font-medium text-muted-foreground">
								Reports are coming in a future update
							</p>
							<p className="max-w-md text-xs text-muted-foreground/80 leading-relaxed">
								The in-game reporting panel and staff review tools are planned
								for a later release and are out of scope for v1.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</ScrollArea>
	);
}
