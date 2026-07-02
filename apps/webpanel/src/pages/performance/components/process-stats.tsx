import {
	type PerfSnapshot,
	PERF_THREADS,
	type PerfThread,
} from '@fxmanager/shared/types';
import { bandLabel } from './perf-buckets';
import { aggregateBuckets, type PerfInspect } from './perf-series';

export function PerfStatsGrid({
	samples,
	inspect,
}: {
	samples: PerfSnapshot[];
	inspect?: PerfInspect | null;
}) {
	const pool: PerfSnapshot[] =
		inspect?.kind === 'point'
			? [inspect.snapshot]
			: inspect?.kind === 'range'
				? inspect.snapshots
				: samples.length
					? [samples[samples.length - 1]]
					: [];

	const getDominantBucket = (thread: PerfThread) => {
		const agg = aggregateBuckets(pool, thread);
		if (!agg) return null;

		let maxFrac = 0;
		let dominantLabel = '';
		agg.frac.forEach((frac, idx) => {
			if (frac > maxFrac) {
				maxFrac = frac;
				dominantLabel = bandLabel(idx);
			}
		});

		return { label: dominantLabel, percentage: maxFrac * 100 };
	};

	return (
		<div className="grid gap-4 sm:grid-cols-3">
			{PERF_THREADS.map((thread) => {
				const dominant = getDominantBucket(thread);

				const threadTitle =
					thread === 'svMain'
						? 'svMain Majority'
						: thread === 'svSync'
							? 'svSync Majority'
							: 'svNetwork Majority';

				const threadDesc =
					thread === 'svMain'
						? 'Dominant tick window for main thread'
						: thread === 'svSync'
							? 'Dominant tick window for sync thread'
							: 'Dominant tick window for network thread';

				return (
					<div key={thread} className="rounded-xl border bg-card p-4">
						<p className="text-sm font-medium text-muted-foreground">
							{threadTitle}
						</p>
						{dominant ? (
							<div className="flex items-baseline gap-2">
								<p className="text-2xl font-bold">≤ {dominant.label}</p>
								<span className="text-sm font-semibold text-emerald-500">
									({dominant.percentage.toFixed(0)}%)
								</span>
							</div>
						) : (
							<p className="text-2xl font-bold text-muted-foreground">—</p>
						)}
						<span className="text-xs text-muted-foreground">{threadDesc}</span>
					</div>
				);
			})}
		</div>
	);
}
