import { Activity, Clock, LayoutDashboard } from 'lucide-react';
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

/* ToDo:
 * Display connected staff counter
 */

export default function DashboardPage() {
	const { state: serverState } = useServerStateSocket();
	const status = serverState?.status ?? 'stopped';

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
				Icon={LayoutDashboard}
				title="Dashboard"
				description="Server overview."
			/>

			<div className="grid content-start gap-4 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-2">
				{stats.map(({ label, value, icon: Icon }) => (
					<Card key={label} className="bg-card/50">
						<CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
							<CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								{label}
							</CardTitle>
							<Icon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent className="pb-4">
							<div className="text-2xl font-bold">{value}</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
