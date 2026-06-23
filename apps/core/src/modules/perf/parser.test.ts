import { describe, expect, it } from 'bun:test';
import { diffPerfs, didPerfReset, parseRawPerf } from './parser';

const sample = `# HELP tickTime time spent
# TYPE tickTime histogram
tickTime_bucket{name="svMain",le="0.005"} 10
tickTime_bucket{name="svMain",le="0.01"} 25
tickTime_bucket{name="svMain",le="+Inf"} 30
tickTime_sum{name="svMain"} 1.5
tickTime_count{name="svMain"} 30
tickTime_bucket{name="svSync",le="0.005"} 5
tickTime_bucket{name="svSync",le="0.01"} 8
tickTime_bucket{name="svSync",le="+Inf"} 8
tickTime_sum{name="svSync"} 0.4
tickTime_count{name="svSync"} 8
tickTime_bucket{name="svNetwork",le="0.005"} 2
tickTime_bucket{name="svNetwork",le="0.01"} 3
tickTime_bucket{name="svNetwork",le="+Inf"} 4
tickTime_sum{name="svNetwork"} 0.2
tickTime_count{name="svNetwork"} 4
`;

describe('parseRawPerf', () => {
	it('extracts count and sum for a thread', () => {
		const perf = parseRawPerf(sample);
		expect(perf.svMain.count).toBe(30);
		expect(perf.svMain.sum).toBeCloseTo(1.5);
	});

	it('extracts cumulative buckets in le order including +Inf', () => {
		const perf = parseRawPerf(sample);
		expect(perf.svMain.buckets).toEqual([10, 25, 30]);
	});

	it('parses all three threads', () => {
		const perf = parseRawPerf(sample);
		expect(Object.keys(perf).sort()).toEqual(['svMain', 'svNetwork', 'svSync']);
		expect(perf.svSync.count).toBe(8);
		expect(perf.svNetwork.count).toBe(4);
	});

	it('ignores comments, blank lines and unrelated metrics', () => {
		const noisy = `# a comment\n\nunrelated_metric{foo="bar"} 99\n${sample}`;
		const perf = parseRawPerf(noisy);
		expect(perf.svMain.count).toBe(30);
		expect(Object.keys(perf)).toHaveLength(3);
	});

	it('omits threads that are absent from the payload', () => {
		const onlyMain = `tickTime_bucket{name="svMain",le="0.005"} 1
tickTime_bucket{name="svMain",le="+Inf"} 2
tickTime_sum{name="svMain"} 0.1
tickTime_count{name="svMain"} 2
`;
		const perf = parseRawPerf(onlyMain);
		expect(Object.keys(perf)).toEqual(['svMain']);
		expect(perf.svSync).toBeUndefined();
	});
});

describe('diffPerfs', () => {
	it('subtracts count, sum and buckets element-wise', () => {
		const prev = parseRawPerf(sample);
		const currText = sample
			.replace(
				'tickTime_count{name="svMain"} 30',
				'tickTime_count{name="svMain"} 50',
			)
			.replace(
				'tickTime_sum{name="svMain"} 1.5',
				'tickTime_sum{name="svMain"} 2.5',
			)
			.replace(
				'tickTime_bucket{name="svMain",le="0.005"} 10',
				'tickTime_bucket{name="svMain",le="0.005"} 14',
			)
			.replace(
				'tickTime_bucket{name="svMain",le="0.01"} 25',
				'tickTime_bucket{name="svMain",le="0.01"} 33',
			)
			.replace(
				'tickTime_bucket{name="svMain",le="+Inf"} 30',
				'tickTime_bucket{name="svMain",le="+Inf"} 50',
			);
		const curr = parseRawPerf(currText);

		const delta = diffPerfs(curr, prev);
		expect(delta.svMain.count).toBe(20);
		expect(delta.svMain.sum).toBeCloseTo(1.0);
		expect(delta.svMain.buckets).toEqual([4, 8, 20]);
	});
});

describe('didPerfReset', () => {
	it('returns false when all values grew or held', () => {
		const prev = parseRawPerf(sample);
		const curr = parseRawPerf(sample); // identical => no regression
		expect(didPerfReset(curr, prev)).toBe(false);
	});

	it('returns true when a counter regressed (server restart)', () => {
		const prev = parseRawPerf(sample);
		const resetText = sample.replace(
			'tickTime_count{name="svMain"} 30',
			'tickTime_count{name="svMain"} 3',
		);
		const curr = parseRawPerf(resetText);
		expect(didPerfReset(curr, prev)).toBe(true);
	});
});
