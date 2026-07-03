export type PerfThread = 'svMain' | 'svSync' | 'svNetwork';

export const PERF_THREADS: readonly PerfThread[] = [
	'svMain',
	'svSync',
	'svNetwork',
] as const;

export const PERF_WINDOW_MS = 30 * 60 * 1000;

/**
 * Per-thread histogram values as scraped from `/perf/`.
 * `buckets` are the cumulative `tickTime_bucket` counts ordered by their `le`
 * (less-than-or-equal) boundary, the last entry being the `+Inf` bucket.
 */
export interface PerfThreadCounts {
	count: number;
	sum: number;
	buckets: number[];
}

/** Raw (or diffed) values for all three threads. */
export type RawPerf = Record<PerfThread, PerfThreadCounts>;

/** A single stored/broadcast performance sample. */
export interface PerfSnapshot {
	ts: number;
	players: number;
	threads: RawPerf;
}

export interface PerfSeriesResponse {
	sessionId: number;
	snapshots: PerfSnapshot[];
}
