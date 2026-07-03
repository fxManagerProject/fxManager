/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows driving the private tick()/fetchRawPerfData + resetting internal state */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';
import type { RawPerf } from '@fxmanager/shared/types';
import { wsManager } from '../ws/manager';
import { sessionManager } from '../session/manager';

// Two consecutive raw scrapes; the second is strictly higher so didPerfReset is
// false and the real diffPerfs yields the deterministic delta below.
const rawA: RawPerf = {
	svMain: { count: 100, sum: 50, buckets: [1, 2, 3] },
	svSync: { count: 10, sum: 5, buckets: [4, 5, 6] },
	svNetwork: { count: 20, sum: 8, buckets: [7, 8, 9] },
};
const rawB: RawPerf = {
	svMain: { count: 105, sum: 52, buckets: [2, 4, 6] },
	svSync: { count: 11, sum: 6, buckets: [5, 6, 7] },
	svNetwork: { count: 22, sum: 9, buckets: [8, 10, 12] },
};
const expectedDiff: RawPerf = {
	svMain: { count: 5, sum: 2, buckets: [1, 2, 3] },
	svSync: { count: 1, sum: 1, buckets: [1, 1, 1] },
	svNetwork: { count: 2, sum: 1, buckets: [1, 2, 3] },
};

const mockInsert = mock(() => {});

// Only mock the DB barrel — the established, leak-safe pattern across this repo.
// The parser + endpoint modules are left intact (they have their own tests);
// fetchRawPerfData is spied per-test so no network/config/parser is touched.
mock.module('@fxmanager/database', () => ({
	repo: { perfSnapshots: { insert: mockInsert } },
}));

const { perfManager } = await import('./manager');

describe('perfManager.tick()', () => {
	let wsSpy: ReturnType<typeof spyOn>;
	let getIdSpy: ReturnType<typeof spyOn>;
	let getPlayersSpy: ReturnType<typeof spyOn>;
	let fetchSpy: ReturnType<typeof spyOn>;

	const tick = () => (perfManager as any).tick();
	const resetInternal = () => {
		(perfManager as any).lastRaw = null;
		(perfManager as any).recent = [];
	};

	beforeEach(() => {
		mockInsert.mockReset();
		wsSpy = spyOn(wsManager, 'broadcast').mockImplementation(() => {});
		getIdSpy = spyOn(sessionManager, 'getCurrentId').mockReturnValue(7);
		getPlayersSpy = spyOn(sessionManager, 'getPlayerCount').mockReturnValue(3);
		fetchSpy = spyOn(perfManager as any, 'fetchRawPerfData')
			.mockResolvedValueOnce(rawA)
			.mockResolvedValueOnce(rawB);
		resetInternal();
	});

	afterEach(() => {
		wsSpy.mockRestore();
		getIdSpy.mockRestore();
		getPlayersSpy.mockRestore();
		fetchSpy.mockRestore();
	});

	it('first tick primes lastRaw without persisting or broadcasting', async () => {
		await tick();
		expect(mockInsert).not.toHaveBeenCalled();
		expect(wsSpy).not.toHaveBeenCalled();
		expect((perfManager as any).lastRaw).toEqual(rawA);
	});

	it('persists + enriches with player count when a session is active', async () => {
		getIdSpy.mockReturnValue(7);
		getPlayersSpy.mockReturnValue(3);

		await tick(); // primes lastRaw = rawA
		await tick(); // diffs rawB - rawA -> snapshot

		expect(mockInsert).toHaveBeenCalledTimes(1);
		expect(mockInsert).toHaveBeenCalledWith({
			sessionId: 7,
			ts: expect.any(Number),
			players: 3,
			perf: expectedDiff,
		});

		expect(wsSpy).toHaveBeenCalledTimes(1);
		const msg = wsSpy.mock.calls[0]?.[0] as {
			channel: string;
			event: string;
			data: { players: number; threads: RawPerf };
		};
		expect(msg.channel).toBe('perf');
		expect(msg.event).toBe('sample');
		expect(msg.data.players).toBe(3);
		expect(msg.data.threads).toEqual(expectedDiff);
	});

	it('broadcasts but does NOT persist when no session is active', async () => {
		getIdSpy.mockReturnValue(null);
		getPlayersSpy.mockReturnValue(5);

		await tick(); // primes lastRaw = rawA
		await tick(); // diffs rawB - rawA -> snapshot

		expect(mockInsert).not.toHaveBeenCalled();
		expect(wsSpy).toHaveBeenCalledTimes(1);
		const msg = wsSpy.mock.calls[0]?.[0] as { data: { players: number } };
		expect(msg.data.players).toBe(5);
	});
});
