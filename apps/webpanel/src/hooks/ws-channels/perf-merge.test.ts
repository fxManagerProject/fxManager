import { describe, expect, it } from 'bun:test';
import type { PerfSnapshot } from '@fxmanager/shared/types';
import { mergeSnapshots, upsertSnapshot } from './perf-merge';

const snap = (ts: number, players = 0): PerfSnapshot => ({
	ts,
	players,
	threads: {},
});

describe('upsertSnapshot', () => {
	it('inserts keeping ts order', () => {
		const list = [snap(1000), snap(3000)];
		expect(upsertSnapshot(list, snap(2000)).map((s) => s.ts)).toEqual([
			1000, 2000, 3000,
		]);
	});

	it('replaces an existing sample with the same ts', () => {
		const list = [snap(1000, 1), snap(2000, 2)];
		const next = upsertSnapshot(list, snap(2000, 9));
		expect(next.map((s) => s.ts)).toEqual([1000, 2000]);
		expect(next[1].players).toBe(9);
	});
});

describe('mergeSnapshots', () => {
	it('keeps live samples that arrived after the fetched backfill', () => {
		const fetched = [snap(1000), snap(2000)];
		const live = [snap(3000)];
		expect(mergeSnapshots(fetched, live).map((s) => s.ts)).toEqual([
			1000, 2000, 3000,
		]);
	});

	it('prefers fetched rows on ts collisions and sorts the result', () => {
		const fetched = [snap(2000, 5), snap(1000, 4)];
		const live = [snap(2000, 9), snap(500, 1)];
		const merged = mergeSnapshots(fetched, live);
		expect(merged.map((s) => s.ts)).toEqual([500, 1000, 2000]);
		expect(merged[2].players).toBe(5);
	});
});
