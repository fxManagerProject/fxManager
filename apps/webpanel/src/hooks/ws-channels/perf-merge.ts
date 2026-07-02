import type { PerfSnapshot } from '@fxmanager/shared/types';

/** Insert a snapshot into a ts-sorted list, replacing any sample with the same
 * timestamp. */
export function upsertSnapshot(
	list: PerfSnapshot[],
	snap: PerfSnapshot,
): PerfSnapshot[] {
	const next = list.filter((s) => s.ts !== snap.ts);
	next.push(snap);
	next.sort((a, b) => a.ts - b.ts);
	return next;
}

/** Merge a fetched backfill with samples that arrived over WS while the fetch
 * was in flight. Fetched rows win on ts collisions. */
export function mergeSnapshots(
	fetched: PerfSnapshot[],
	live: PerfSnapshot[],
): PerfSnapshot[] {
	const byTs = new Map<number, PerfSnapshot>();
	for (const s of live) byTs.set(s.ts, s);
	for (const s of fetched) byTs.set(s.ts, s);
	return [...byTs.values()].sort((a, b) => a.ts - b.ts);
}
