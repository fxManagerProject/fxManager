import { useMemo } from 'react';
import {
	PERF_WINDOW_MS,
	type PerfSnapshot,
	type PerfThread,
} from '@fxmanager/shared/types';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import { BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { BANDS, bandColor, bandLabel } from './perf-buckets';
import { aggregateBuckets, type PerfInspect } from './perf-series';

/** Live view: aggregate the last 30 min (fallback to the newest sample). */
function liveAggregate(samples: PerfSnapshot[], thread: PerfThread) {
	const cutoff = Date.now() - PERF_WINDOW_MS;
	let pool = samples.filter((s) => s.ts >= cutoff && s.threads[thread]);
	if (pool.length === 0) {
		const last = samples.filter((s) => s.threads[thread]).at(-1);
		pool = last ? [last] : [];
	}
	return aggregateBuckets(pool, thread);
}

export function PerfDistribution({
	samples,
	inspect,
	thread,
}: {
	samples: PerfSnapshot[];
	inspect?: PerfInspect | null;
	thread: PerfThread;
}) {
	const data = useMemo(() => {
		if (inspect?.kind === 'point')
			return aggregateBuckets([inspect.snapshot], thread);
		if (inspect?.kind === 'range')
			return aggregateBuckets(inspect.snapshots, thread);
		return liveAggregate(samples, thread);
	}, [samples, thread, inspect]);

	return (
		<Card>
			<CardHeader className="space-y-1.5">
				<CardTitle className="flex items-center gap-2">
					<BarChart3 className="h-4 w-4" />
					{thread} performance
				</CardTitle>
				<CardDescription>
					{!data
						? 'No performance data yet'
						: inspect?.kind === 'point'
							? `At ${format(new Date(inspect.snapshot.ts), 'HH:mm')} — ${data.totalTicks.toLocaleString()} ticks`
							: inspect?.kind === 'range'
								? `From ${format(new Date(inspect.start), 'HH:mm')} – ${format(new Date(inspect.end), 'HH:mm')} — ${data.totalTicks.toLocaleString()} ticks`
								: `Tick-time distribution over the last 30 min — ${data.totalTicks.toLocaleString()} ticks`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{!data ? (
					<div
						style={{
							height: `calc((${BANDS} * 10px) + ((${BANDS} - 1) * 4px))`,
						}}
						className="flex items-center justify-center text-center text-sm text-muted-foreground"
					>
						No performance data yet. Metrics appear ~30s after the server
						starts.
					</div>
				) : (
					<div className="space-y-1">
						{Array.from({ length: BANDS }, (_, idx) => {
							// render slowest (+Inf) at the top, fastest (1ms) at the bottom
							const i = BANDS - 1 - idx;
							const pct = (data.frac[i] ?? 0) * 100;
							return (
								<div
									key={bandLabel(i)}
									className="flex items-center gap-2 text-xs"
								>
									<span className="w-11 shrink-0 text-right text-muted-foreground tabular-nums">
										{bandLabel(i)}
									</span>
									<div className="relative h-2.5 flex-1 overflow-hidden rounded bg-muted/30">
										<div
											className="h-full rounded"
											style={{
												width: `${Math.min(100, pct)}%`,
												backgroundColor: bandColor(i),
											}}
										/>
									</div>
									<span className="w-14 shrink-0 text-right tabular-nums">
										{pct.toFixed(1)}%
									</span>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
