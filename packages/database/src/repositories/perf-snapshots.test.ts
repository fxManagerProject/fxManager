/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows clearing private singletons */
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../schema';
import { migrations, runMigrations } from '../migrations';
import { createPerfSnapshotsRepository } from './perf-snapshots';
import { createServerSessionsRepository } from './server-sessions';

describe('PerfSnapshotsRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let repo: ReturnType<typeof createPerfSnapshotsRepository>;
	let sessions: ReturnType<typeof createServerSessionsRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		const zeroPerf = createPerfSnapshotsRepository({} as any);
		(zeroPerf.constructor as any).instance = undefined;
		const zeroSessions = createServerSessionsRepository({} as any);
		(zeroSessions.constructor as any).instance = undefined;

		testSqlite = new Database(':memory:');
		testSqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		repo = createPerfSnapshotsRepository(testDb);
		sessions = createServerSessionsRepository(testDb);
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	it('insert + listForSession round-trips perf JSON and players', () => {
		const s = sessions.open(new Date(1000));
		const perf = {
			svMain: { count: 10, sum: 5, buckets: [1, 2, 3] },
			svSync: { count: 4, sum: 2, buckets: [4, 5, 6] },
			svNetwork: { count: 7, sum: 3, buckets: [7, 8, 9] },
		};

		repo.insert({ sessionId: s.id, ts: 1234, players: 12, perf });

		const rows = repo.listForSession(s.id);
		expect(rows.length).toBe(1);
		expect(rows[0].ts).toBe(1234);
		expect(rows[0].players).toBe(12);
		expect(rows[0].perf).toEqual(perf);
	});

	it('returns snapshots ordered by ts asc', () => {
		const s = sessions.open(new Date(1000));
		const perf = {
			svMain: { count: 1, sum: 1, buckets: [1] },
			svSync: { count: 1, sum: 1, buckets: [1] },
			svNetwork: { count: 1, sum: 1, buckets: [1] },
		};

		repo.insert({ sessionId: s.id, ts: 3000, players: 3, perf });
		repo.insert({ sessionId: s.id, ts: 1000, players: 1, perf });
		repo.insert({ sessionId: s.id, ts: 2000, players: 2, perf });

		const rows = repo.listForSession(s.id);
		expect(rows.map((r) => r.ts)).toEqual([1000, 2000, 3000]);
		expect(rows.map((r) => r.players)).toEqual([1, 2, 3]);
	});

	it('only returns snapshots for the requested session', () => {
		const a = sessions.open(new Date(1000));
		const b = sessions.open(new Date(2000));
		const perf = {
			svMain: { count: 1, sum: 1, buckets: [1] },
			svSync: { count: 1, sum: 1, buckets: [1] },
			svNetwork: { count: 1, sum: 1, buckets: [1] },
		};

		repo.insert({ sessionId: a.id, ts: 1000, players: 1, perf });
		repo.insert({ sessionId: b.id, ts: 2000, players: 2, perf });

		expect(repo.listForSession(a.id).map((r) => r.ts)).toEqual([1000]);
		expect(repo.listForSession(b.id).map((r) => r.ts)).toEqual([2000]);
	});

	it('filters snapshots to a [from, to] window', () => {
		const s = sessions.open(new Date(1000));
		const perf = {
			svMain: { count: 1, sum: 1, buckets: [1] },
			svSync: { count: 1, sum: 1, buckets: [1] },
			svNetwork: { count: 1, sum: 1, buckets: [1] },
		};
		for (const ts of [1000, 2000, 3000, 4000]) {
			repo.insert({ sessionId: s.id, ts, players: 0, perf });
		}

		const rows = repo.listForSession(s.id, { from: 2000, to: 3000 });
		expect(rows.map((r) => r.ts)).toEqual([2000, 3000]);
	});

	it('limit keeps only the newest snapshots, still ordered ts asc', () => {
		const s = sessions.open(new Date(1000));
		const perf = {
			svMain: { count: 1, sum: 1, buckets: [1] },
			svSync: { count: 1, sum: 1, buckets: [1] },
			svNetwork: { count: 1, sum: 1, buckets: [1] },
		};
		for (const ts of [1000, 2000, 3000, 4000]) {
			repo.insert({ sessionId: s.id, ts, players: 0, perf });
		}

		const rows = repo.listForSession(s.id, { limit: 2 });
		expect(rows.map((r) => r.ts)).toEqual([3000, 4000]);
	});

	it('defaults fxsMemory and nodeMemory to null when omitted', () => {
		const s = sessions.open(new Date(1000));
		const perf = {
			svMain: { count: 1, sum: 1, buckets: [1] },
			svSync: { count: 1, sum: 1, buckets: [1] },
			svNetwork: { count: 1, sum: 1, buckets: [1] },
		};

		repo.insert({ sessionId: s.id, ts: 1000, players: 0, perf });

		const row = repo.listForSession(s.id)[0];
		expect(row.fxsMemory).toBeNull();
		expect(row.nodeMemory).toBeNull();
	});
});
