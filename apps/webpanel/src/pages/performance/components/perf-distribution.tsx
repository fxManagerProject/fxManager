import { useMemo, useState } from 'react';
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import { BarChart3 } from 'lucide-react';
import { BANDS, bandColor, bandLabel } from './perf-buckets';

const THREADS: { value: PerfThread; label: string }[] = [
	{ value: 'svMain', label: 'svMain' },
	{ value: 'svNetwork', label: 'svNetwork' },
	{ value: 'svSync', label: 'svSync' },
];

interface Aggregate {
	frac: number[];
	totalTicks: number;
	windows: number;
}

function aggregate(
	samples: PerfSnapshot[],
	thread: PerfThread,
): Aggregate | null {
	const cutoff = Date.now() - PERF_WINDOW_MS;
	let pool = samples.filter((s) => s.ts >= cutoff && s.threads[thread]);
	if (pool.length === 0) {
		const all = samples.filter((s) => s.threads[thread]);
		const last = all[all.length - 1];
		pool = last ? [last] : [];
	}
	if (pool.length === 0) return null;

	const bucketTicks = new Array<number>(BANDS).fill(0);
	let totalTicks = 0;
	for (const sample of pool) {
		const counts = sample.threads[thread];
		if (!counts) continue;
		let prev = 0;
		for (let b = 0; b < BANDS; b++) {
			const cumulative = counts.buckets[b] ?? prev;
			bucketTicks[b] = (bucketTicks[b] ?? 0) + (cumulative - prev);
			prev = cumulative;
		}
		totalTicks += counts.count || 0;
	}
	if (totalTicks <= 0) return null;

	return {
		frac: bucketTicks.map((t) => t / totalTicks),
		totalTicks,
		windows: pool.length,
	};
}

export function PerfDistribution({ samples }: { samples: PerfSnapshot[] }) {
	const [thread, setThread] = useState<PerfThread>('svMain');

	const data = useMemo(() => aggregate(samples, thread), [samples, thread]);

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
				<div className="space-y-1.5">
					<CardTitle className="flex items-center gap-2">
						<BarChart3 className="h-4 w-4" />
						{thread} performance
					</CardTitle>
					<CardDescription>
						{data
							? `Tick-time distribution over the last 30 min — ${data.totalTicks.toLocaleString()} ticks`
							: 'No performance data yet'}
					</CardDescription>
				</div>
				<Select
					value={thread}
					onValueChange={(v) => setThread(v as PerfThread)}
				>
					<SelectTrigger className="w-[130px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{THREADS.map(({ value, label }) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</CardHeader>
			<CardContent>
				{!data ? (
					<div
						style={{
							height: `calc((${BANDS} * 16px) + ((${BANDS} - 1) * 6px))`,
						}}
						className="flex items-center justify-center text-center text-sm text-muted-foreground"
					>
						No performance data yet. Metrics appear ~30s after the server
						starts.
					</div>
				) : (
					<div className="space-y-1.5">
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
									<div className="relative h-4 flex-1 overflow-hidden rounded bg-muted/30">
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
