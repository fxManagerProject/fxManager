import {
	Activity,
	Clock,
	MonitorCog,
	Play,
	RefreshCw,
	Square,
} from 'lucide-react';
import { HandleServerAction } from '@/lib/query';
import { formatUptime } from '@/lib/utils';
import { STATUS_VARIANT } from '@/static/server-state';
import { PageHeader } from '@/components/page-header';
import { useServerStateSocket } from '@/hooks/ws-channels';
import { Badge } from '@fxmanager/ui/components/badge';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import { Button } from '@fxmanager/ui/components/button';

/* ToDo:
 * Consider adding wider details on process health
 * Displayed as graphs
 * Display connected staff counter
 */

export default function DashboardPage() {
	const { state: serverState } = useServerStateSocket();
	const status = serverState?.status ?? 'stopped';
	const isRunning = status === 'running';
	const canStart = status === 'stopped' || status === 'crashed';

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
	];

	return (
		<div className="space-y-6">
			<PageHeader
				Icon={MonitorCog}
				title="Server Controls"
				description="Server overview and controls."
			/>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{stats.map(({ label, value, icon: Icon }) => (
					<Card key={label} className="bg-card/50">
						<CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
							<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								{label}
							</CardTitle>
							<Icon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent className="pb-4">
							<div className="text-xl font-bold">{value}</div>
						</CardContent>
					</Card>
				))}
			</div>

			<Card className="bg-card/50 right-0">
				<CardHeader>
					<CardTitle className="text-sm font-medium">Server Controls</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Button
						size="sm"
						variant="outline"
						disabled={!canStart}
						onClick={() => HandleServerAction('start')}
						className="border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
					>
						<Play className="mr-1.5 h-3.5 w-3.5" /> Start
					</Button>
					<Button
						size="sm"
						variant="outline"
						disabled={!isRunning}
						onClick={() => HandleServerAction('stop')}
						className="border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40"
					>
						<Square className="mr-1.5 h-3.5 w-3.5" /> Stop
					</Button>
					<Button
						size="sm"
						variant="outline"
						disabled={!isRunning}
						onClick={() => HandleServerAction('restart')}
						className="border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40"
					>
						<RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Restart
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
