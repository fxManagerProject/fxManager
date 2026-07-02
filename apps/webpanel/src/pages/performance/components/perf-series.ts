import type { PerfSnapshot, PerfThread } from '@fxmanager/shared/types';
import { BANDS } from './perf-buckets';

export type PerfInspect =
	| { kind: 'point'; snapshot: PerfSnapshot }
	| { kind: 'range'; snapshots: PerfSnapshot[]; start: number; end: number };

/** Sum tick counts across a pool of snapshots for one thread → per-band
 * fractions + total ticks. Returns null when the pool has no ticks. */
export function aggregateBuckets(
	pool: PerfSnapshot[],
	thread: PerfThread,
): { frac: number[]; totalTicks: number } | null {
	const ticks = new Array<number>(BANDS).fill(0);
	let total = 0;
	for (const s of pool) {
		const c = s.threads[thread];
		if (!c) continue;
		let prev = 0;
		for (let b = 0; b < BANDS; b++) {
			const cum = c.buckets[b] ?? prev;
			ticks[b] += cum - prev;
			prev = cum;
		}
		total += c.count || 0;
	}
	if (total <= 0) return null;
	return { frac: ticks.map((t) => t / total), totalTicks: total };
}

/** De-cumulate one snapshot+thread's cumulative buckets into per-band tick
 * fractions (each in [0,1], summing to ~1). Returns all-zero if no ticks. */
export function bandFractions(
	snapshot: PerfSnapshot,
	thread: PerfThread,
): number[] {
	return (
		aggregateBuckets([snapshot], thread)?.frac ??
		new Array<number>(BANDS).fill(0)
	);
}

/** Index of the heatmap cell [ts_i, next ts) containing ts, mirroring how
 * cells are painted (the last cell extends to the right edge). -1 when ts is
 * outside [min, max] or before the first snapshot. */
export function snapshotIdxAt(
	snapshots: PerfSnapshot[],
	ts: number,
	min: number,
	max: number,
): number {
	if (ts < min || ts > max) return -1;
	let idx = -1;
	for (let i = 0; i < snapshots.length; i++) {
		if (snapshots[i].ts > ts) break;
		idx = i;
	}
	return idx;
}
