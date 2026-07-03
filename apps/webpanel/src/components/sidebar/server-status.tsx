import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenuButton,
	useSidebar,
} from '@fxmanager/ui/components/sidebar';
import { Card, CardContent } from '@fxmanager/ui/components/card';
import { Badge } from '@fxmanager/ui/components/badge';
import { STATUS_VARIANT } from '@/static/server-state';
import { formatDuration, formatRemaining, isServerRunning } from '@/lib/utils';
import { Button } from '@fxmanager/ui/components/button';
import {
	ExternalLink,
	MonitorCog,
	Play,
	RefreshCw,
	Square,
	type LucideIcon,
} from 'lucide-react';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@fxmanager/ui/components/tooltip';
import { HandleServerAction } from '@/lib/query';
import { usePlayerlistSocket, useServerStateSocket } from '@/hooks/ws-channels';
import { useRecommendedArtifact } from '@/hooks/use-recommended-artifact';
import { useSchedule } from '@/hooks/use-schedule';
import { useEffect, useState } from 'react';

const TEMP_PRESETS = [5, 15, 30] as const;

interface ActionButtonProps {
	Icon: LucideIcon;
	colour: string;
	action: 'start' | 'stop' | 'restart';
	disabled: boolean;
	tooltip?: string;
}

function ActionButton({
	action,
	Icon,
	colour,
	disabled = false,
	tooltip,
}: ActionButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					size="sm"
					variant="outline"
					disabled={disabled}
					onClick={() => {
						HandleServerAction(action);
					}}
					className={`flex-1 border-${colour}/30 text-${colour} hover:bg-${colour}/10 disabled:opacity-40`}
				>
					<Icon className="h-3.5 w-3.5" />
				</Button>
			</TooltipTrigger>
			{tooltip && (
				<TooltipContent>
					<p>{tooltip}</p>
				</TooltipContent>
			)}
		</Tooltip>
	);
}

export function ServerStatusCard() {
	const { state: serverState } = useServerStateSocket();
	const { count } = usePlayerlistSocket();
	const recommendedArtifact = useRecommendedArtifact();
	const { state: sideBarState, setOpen } = useSidebar();
	const { status: schedule, restartIn, skip } = useSchedule();
	const isCollapsed = sideBarState === 'collapsed';
	const canStart =
		serverState.status === 'stopped' || serverState.status === 'crashed';
	const canStop =
		serverState.status === 'running' || serverState.status === 'starting';

	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const nextRestartMs = schedule?.nextRestart
		? new Date(schedule.nextRestart).getTime() - now
		: null;
	const uptimeMs =
		isServerRunning(serverState.status) && serverState.startedAt
			? now - new Date(serverState.startedAt).getTime()
			: null;
	const hasUpcomingRestart = nextRestartMs !== null;

	if (isCollapsed) {
		return (
			<div className="flex flex-col items-center">
				<SidebarMenuButton
					tooltip="View server status"
					onClick={() => setOpen(true)}
				>
					<MonitorCog />
				</SidebarMenuButton>
			</div>
		);
	}

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Server Status</SidebarGroupLabel>
			<Card>
				<CardContent className="space-y-3">
					<div className="flex flex-row justify-between">
						<p>Status</p>
						<Badge variant={STATUS_VARIANT[serverState.status]}>
							{serverState.status}
						</Badge>
					</div>
					<div className="flex flex-row justify-between">
						<p>Uptime</p>
						<p>
							{serverState?.startedAt &&
							isServerRunning(serverState?.status) &&
							uptimeMs
								? formatDuration(uptimeMs)
								: 'N/A'}
						</p>
					</div>
					<div className="flex flex-row justify-between">
						<p>Players:</p>
						<p>{count}</p>
					</div>
					<div className="flex flex-row justify-between">
						<p>Next restart</p>
						<p className="tabular-nums">
							{hasUpcomingRestart ? (
								<>
									{formatRemaining(nextRestartMs, 'in')}
									{schedule?.temporary && (
										<span className="text-muted-foreground"> (manual)</span>
									)}
								</>
							) : (
								<span className="text-muted-foreground">Not scheduled</span>
							)}
						</p>
					</div>
					<div>
						<p className="mb-2 text-sm font-medium">Actions</p>
						<div className="flex w-full flex-row gap-2">
							<ActionButton
								action="start"
								disabled={!canStart}
								colour="green-400"
								Icon={Play}
								tooltip="Start server"
							/>
							<ActionButton
								action="stop"
								disabled={!canStop}
								colour="destructive"
								Icon={Square}
								tooltip="Stop server"
							/>
							<ActionButton
								action="restart"
								disabled={!canStop}
								colour="primary"
								Icon={RefreshCw}
								tooltip="Restart server"
							/>
						</div>
					</div>
					<div className="space-y-2">
						<p className="text-sm font-medium">Quick restart</p>
						<div className="flex w-full flex-row gap-2">
							{TEMP_PRESETS.map((m) => (
								<Button
									key={m}
									size="sm"
									variant="outline"
									disabled={!canStop}
									className="flex-1"
									onClick={() => restartIn(m)}
								>
									+{m}m
								</Button>
							))}
						</div>
						<Button
							size="sm"
							variant="ghost"
							className="w-full"
							disabled={!hasUpcomingRestart}
							onClick={() => skip()}
						>
							Cancel restart
						</Button>
					</div>
					{serverState.version && (
						<div className="space-y-3 border-t pt-3">
							<div className="flex flex-row justify-between">
								<p>Artifact</p>
								<p className="font-mono">b{serverState.version}</p>
							</div>
							{recommendedArtifact && (
								<div className="flex flex-row justify-between">
									<p>Recommended</p>
									<a
										href="https://artifacts.jgscripts.com/"
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
										title="Source: artifacts.jgscripts.com"
									>
										b{recommendedArtifact}
										<ExternalLink className="h-3 w-3" />
									</a>
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</SidebarGroup>
	);
}
