import { Activity, Clock, LayoutDashboard, Shield, User } from 'lucide-react';
import { formatRemaining, formatUptime } from '@/lib/utils';
import { STATUS_VARIANT } from '@/static/server-state';
import { PageHeader } from '@/components/page-header';
import { usePlayerlistSocket, useServerStateSocket } from '@/hooks/ws-channels';
import { Badge } from '@fxmanager/ui/components/badge';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import { useSchedule } from '@/hooks/use-schedule';
import { useMemo } from 'react';
import { ScrollArea, ScrollBar } from '@fxmanager/ui/components/scroll-area';

function pingColor(ping?: number): string {
	if (ping === undefined) return 'text-zinc-500';
	if (ping < 80) return 'text-emerald-400';
	if (ping < 150) return 'text-yellow-400';
	return 'text-red-500';
}

export default function DashboardPage() {
	const { state: serverState } = useServerStateSocket();
	const { status: schedule } = useSchedule();
	const { players: rawPlayers } = usePlayerlistSocket();

	const status = serverState?.status ?? 'stopped';
	const nextRestartMs = schedule?.nextRestart
		? new Date(schedule.nextRestart).getTime() - Date.now()
		: null;

	const staffData = useMemo(() => {
		const connectedStaff = rawPlayers.filter((p) => p.isStaff);
		return {
			list: connectedStaff,
			count: connectedStaff.length,
		};
	}, [rawPlayers]);

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
			value: serverState?.startedAt ? formatUptime(serverState.startedAt) : '—',
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
					<Card className="bg-card/50 h-[300px] flex items-center justify-center text-muted-foreground">
						somethin like player count overtime ?
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
													<span className={`text-xs ${pingColor(admin.ping)}`}>
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
		</div>
	);
}
