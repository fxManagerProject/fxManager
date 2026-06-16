import {
	type PerfSnapshot,
	PERF_THREADS,
	type PerfThread,
} from '@fxmanager/shared/types';
import { bandLabel } from './perf-buckets';

export function PerfStatsGrid({ samples }: { samples: PerfSnapshot[] }) {
	const latestSample = samples[samples.length - 1];

	const getDominantBucket = (thread: PerfThread) => {
		if (!latestSample || !latestSample.threads[thread]) return null;

		const currentThread = latestSample.threads[thread];
		const totalCount = currentThread.count;

		if (totalCount === 0) return null;

		let maxPct = 0;
		let dominantLabel = '';

		let previousCount = 0;
		currentThread.buckets.forEach((cumulativeCount, idx) => {
			const bucketCount = cumulativeCount - previousCount;
			const pct = (bucketCount / totalCount) * 100;

			if (pct > maxPct) {
				maxPct = pct;
				dominantLabel = bandLabel(idx);
			}
			previousCount = cumulativeCount;
		});

		return { label: dominantLabel, percentage: maxPct };
	};

	return (
		<div className="grid gap-4 md:grid-cols-3">
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
