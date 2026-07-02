import { describe, expect, it } from 'bun:test';
import type {
	PerfSnapshot,
	PerfThreadCounts,
	RawPerf,
} from '@fxmanager/shared/types';
import { BANDS } from './perf-buckets';
import { bandFractions, snapshotIdxAt } from './perf-series';

/** Build a 15-length cumulative buckets array from per-band tick counts. */
function cumulative(perBand: number[]): number[] {
	const out: number[] = [];
	let acc = 0;
	for (let i = 0; i < BANDS; i++) {
		acc += perBand[i] ?? 0;
		out.push(acc);
	}
	return out;
}

function thread(count: number, perBand: number[]): PerfThreadCounts {
	return { count, sum: 0, buckets: cumulative(perBand) };
}

function snapshot(
	ts: number,
	players: number,
	main: PerfThreadCounts,
): PerfSnapshot {
	const empty: PerfThreadCounts = { count: 0, sum: 0, buckets: [] };
	const threads: RawPerf = { svMain: main, svSync: empty, svNetwork: empty };
	return { ts, players, threads };
}

describe('bandFractions', () => {
	it('de-cumulates cumulative buckets into per-band fractions', () => {
		// 4 bands populated: 2, 3, 0, 5; rest zero. count = 10.
		const perBand = [2, 3, 0, 5];
		const snap = snapshot(1_000, 7, thread(10, perBand));

		const frac = bandFractions(snap, 'svMain');

		expect(frac).toHaveLength(BANDS);
		expect(frac[0]).toBeCloseTo(0.2);
		expect(frac[1]).toBeCloseTo(0.3);
		expect(frac[2]).toBeCloseTo(0);
		expect(frac[3]).toBeCloseTo(0.5);
		for (let i = 4; i < BANDS; i++) expect(frac[i]).toBeCloseTo(0);
		// fractions sum to ~1
		expect(frac.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
	});

	it('returns all zeros when the thread has no ticks', () => {
		const snap = snapshot(1_000, 0, thread(0, []));
		const frac = bandFractions(snap, 'svMain');
		expect(frac).toHaveLength(BANDS);
		expect(frac.every((v) => v === 0)).toBe(true);
	});

	it('returns all zeros for a thread not present in the snapshot', () => {
		const snap = snapshot(1_000, 3, thread(10, [10]));
		// svSync is the empty (count 0) thread here.
		const frac = bandFractions(snap, 'svSync');
		expect(frac.every((v) => v === 0)).toBe(true);
	});
});

describe('snapshotIdxAt', () => {
	const snaps = [0, 30_000, 60_000, 90_000].map((ts) =>
		snapshot(ts, 0, thread(1, [1])),
	);

	it('returns the cell containing ts, not the nearest snapshot', () => {
		expect(snapshotIdxAt(snaps, 40_000, 0, 90_000)).toBe(1);
		// 50s is closer to the 60s sample but still inside the 30s cell
		expect(snapshotIdxAt(snaps, 50_000, 0, 90_000)).toBe(1);
		expect(snapshotIdxAt(snaps, 60_000, 0, 90_000)).toBe(2);
	});

	it('never returns a snapshot past ts near the zoom edge', () => {
		expect(snapshotIdxAt(snaps, 74_000, 30_000, 75_000)).toBe(2);
	});

	it('returns the partially visible cell when zoomed between samples', () => {
		expect(snapshotIdxAt(snaps, 20_000, 15_000, 25_000)).toBe(0);
	});

	it('returns -1 before the first snapshot, outside the window, or when empty', () => {
		expect(snapshotIdxAt(snaps, -5_000, -10_000, 90_000)).toBe(-1);
		expect(snapshotIdxAt(snaps, 95_000, 0, 90_000)).toBe(-1);
		expect(snapshotIdxAt([], 0, 0, 100)).toBe(-1);
	});
});
