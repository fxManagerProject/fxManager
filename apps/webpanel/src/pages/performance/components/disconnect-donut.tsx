import { useEffect, useState } from 'react';
import {
	DISCONNECT_CATEGORIES,
	type DisconnectCounts,
	type DisconnectSession,
	type ServerSession,
	zeroDisconnectCounts,
} from '@fxmanager/shared/types';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@fxmanager/ui/components/chart';
import { PieChart as PieChartIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Label, Pie, PieChart } from 'recharts';
import { QueryService } from '@/lib/query';
import { useWsChannel } from '@/hooks/ws-channels/use-ws-core';

const chartConfig = Object.fromEntries(
	DISCONNECT_CATEGORIES.map((c) => [c.key, { label: c.label, color: c.color }]),
) satisfies ChartConfig;

export function DisconnectDonut({
	sessionId,
	session,
	isLive,
	zoom,
}: {
	sessionId: number | null;
	session: ServerSession | null;
	isLive: boolean;
	zoom: { start: number; end: number } | null;
}) {
	const { state: live } = useWsChannel<DisconnectSession | null>(
		'disconnects',
		'update',
		null,
	);
	const [fetched, setFetched] = useState<DisconnectCounts | null>(null);

	useEffect(() => {
		if (sessionId == null) {
			setFetched(null);
			return;
		}
		const q = zoom
			? `?from=${Math.floor(zoom.start)}&to=${Math.ceil(zoom.end)}`
			: '';
		let cancelled = false;
		QueryService<DisconnectCounts>({
			endpoint: `/disconnects/sessions/${sessionId}${q}`,
			method: 'GET',
		})
			.then((c) => {
				if (!cancelled) setFetched(c);
			})
			.catch(() => {
				if (!cancelled) setFetched(null);
			});
		return () => {
			cancelled = true;
		};
	}, [sessionId, zoom]);

	// Live session, unzoomed → the real-time WS running total; else the fetched
	// counts (a whole-session total or a zoomed slice).
	const counts: DisconnectCounts =
		isLive && !zoom && live && live.id === sessionId
			? live
			: (fetched ?? zeroDisconnectCounts());

	const total = DISCONNECT_CATEGORIES.reduce((s, c) => s + counts[c.key], 0);

	const scope = zoom
		? `${format(new Date(zoom.start), 'HH:mm')} – ${format(new Date(zoom.end), 'HH:mm')}`
		: session
			? session.endedAt === null
				? 'this session'
				: 'this restart'
			: 'this session';

	const data = DISCONNECT_CATEGORIES.filter((cat) => counts[cat.key] > 0).map(
		(cat) => ({
			category: cat.key,
			count: counts[cat.key],
			fill: cat.color,
		}),
	);

	return (
		<Card>
			<CardHeader className="space-y-1.5">
				<CardTitle className="flex items-center gap-2">
					<PieChartIcon className="h-4 w-4" />
					Disconnect reasons
				</CardTitle>
				<CardDescription>
					{total > 0
						? `${total.toLocaleString()} disconnects · ${scope}`
						: `Why players left · ${scope}`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{total === 0 ? (
					<div className="flex h-[180px] items-center justify-center text-center text-sm text-muted-foreground">
						No disconnects in {zoom ? 'this window' : 'this session'} yet.
					</div>
				) : (
					<div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-around">
						<ChartContainer
							config={chartConfig}
							className="aspect-square w-full max-w-[240px] shrink-0"
							role="img"
							aria-label="Disconnect reasons breakdown"
						>
							<PieChart>
								<ChartTooltip
									cursor={false}
									content={<ChartTooltipContent hideLabel />}
								/>
								<Pie
									data={data}
									dataKey="count"
									nameKey="category"
									innerRadius={60}
									strokeWidth={5}
								>
									<Label
										content={({ viewBox }) => {
											if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
												return (
													<text
														x={viewBox.cx}
														y={viewBox.cy}
														textAnchor="middle"
														dominantBaseline="middle"
													>
														<tspan
															x={viewBox.cx}
															y={viewBox.cy}
															className="fill-foreground text-3xl font-semibold tabular-nums"
														>
															{total.toLocaleString()}
														</tspan>
														<tspan
															x={viewBox.cx}
															y={(viewBox.cy || 0) + 24}
															className="fill-muted-foreground"
														>
															disconnects
														</tspan>
													</text>
												);
											}
										}}
									/>
								</Pie>
							</PieChart>
						</ChartContainer>
						<div className="w-full max-w-[240px] space-y-2">
							{DISCONNECT_CATEGORIES.map((cat) => {
								const value = counts[cat.key];
								const pct = total > 0 ? (value / total) * 100 : 0;
								return (
									<div
										key={cat.key}
										className="flex items-center gap-2 text-sm"
									>
										<span
											className="h-3 w-3 shrink-0 rounded-sm"
											style={{ backgroundColor: cat.color }}
										/>
										<span className="flex-1">{cat.label}</span>
										<span className="tabular-nums text-muted-foreground">
											{value}
										</span>
										<span className="w-12 text-right tabular-nums">
											{pct.toFixed(1)}%
										</span>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
