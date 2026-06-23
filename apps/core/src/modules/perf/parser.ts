import {
	PERF_THREADS,
	type PerfThread,
	type PerfThreadCounts,
	type RawPerf,
} from '@fxmanager/shared/types';

// Matches the FXServer `/perf/` Prometheus lines, e.g.
//   tickTime_count{name="svMain"} 30
//   tickTime_sum{name="svMain"} 1.5
//   tickTime_bucket{name="svMain",le="0.005"} 10
const LINE_RE =
	/^tickTime_(count|sum|bucket)\{name="(svMain|svSync|svNetwork)"(?:,le="([^"]+)")?\}\s+(.+)$/;

interface BuildingThread {
	count?: number;
	sum?: number;
	bucketPairs: { le: number; value: number }[];
}

/**
 * Parses raw FXServer `/perf/` Prometheus text into per-thread histogram
 * counts. Threads absent from the payload are omitted from the result.
 */
export function parseRawPerf(text: string): RawPerf {
	const building = new Map<PerfThread, BuildingThread>();

	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;

		const match = LINE_RE.exec(line);
		if (!match) continue;

		const [, kind, threadName, le, valueStr] = match;
		const value = Number(valueStr);
		if (!Number.isFinite(value)) continue;

		const thread = threadName as PerfThread;
		let entry = building.get(thread);
		if (!entry) {
			entry = { bucketPairs: [] };
			building.set(thread, entry);
		}

		if (kind === 'count') {
			entry.count = value;
		} else if (kind === 'sum') {
			entry.sum = value;
		} else if (kind === 'bucket') {
			const boundary = le === '+Inf' ? Infinity : Number(le);
			entry.bucketPairs.push({ le: boundary, value });
		}
	}

	const result = {} as RawPerf;
	for (const thread of PERF_THREADS) {
		const entry = building.get(thread);
		if (!entry) continue;

		const sorted = [...entry.bucketPairs].sort((a, b) => a.le - b.le);
		result[thread] = {
			count: entry.count ?? 0,
			sum: entry.sum ?? 0,
			buckets: sorted.map((p) => p.value),
		} satisfies PerfThreadCounts;
	}

	return result;
}

/**
 * Returns the per-window delta between two scrapes (curr - prev), thread by
 * thread and bucket by bucket. When a thread has no previous snapshot, the
 * current values are returned unchanged.
 */
export function diffPerfs(curr: RawPerf, prev: RawPerf): RawPerf {
	const result = {} as RawPerf;

	for (const thread of PERF_THREADS) {
		const c = curr[thread];
		if (!c) continue;

		const p = prev[thread];
		if (!p) {
			result[thread] = c;
			continue;
		}

		result[thread] = {
			count: c.count - p.count,
			sum: c.sum - p.sum,
			buckets: c.buckets.map((v, i) => v - (p.buckets[i] ?? 0)),
		};
	}

	return result;
}

/**
 * Detects an FXServer restart: the `/perf/` counters are monotonic, so any
 * value in `curr` lower than `prev` means they were reset.
 */
export function didPerfReset(curr: RawPerf, prev: RawPerf): boolean {
	for (const thread of PERF_THREADS) {
		const c = curr[thread];
		const p = prev[thread];
		if (!c || !p) continue;

		if (c.count < p.count || c.sum < p.sum) return true;

		for (let i = 0; i < c.buckets.length; i++) {
			if ((c.buckets[i] ?? 0) < (p.buckets[i] ?? 0)) return true;
		}
	}

	return false;
}
