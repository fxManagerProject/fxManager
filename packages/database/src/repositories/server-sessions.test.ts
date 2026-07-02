/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows clearing private singletons */
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../schema';
import { migrations, runMigrations } from '../migrations';
import { createServerSessionsRepository } from './server-sessions';
import { createPerfSnapshotsRepository } from './perf-snapshots';

describe('ServerSessionsRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let repo: ReturnType<typeof createServerSessionsRepository>;
	let perf: ReturnType<typeof createPerfSnapshotsRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		const zeroState = createServerSessionsRepository({} as any);
		(zeroState.constructor as any).instance = undefined;
		const zeroPerf = createPerfSnapshotsRepository({} as any);
		(zeroPerf.constructor as any).instance = undefined;

		testSqlite = new Database(':memory:');
		testSqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		repo = createServerSessionsRepository(testDb);
		perf = createPerfSnapshotsRepository(testDb);
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	it('open() inserts a running session', () => {
		const s = repo.open(new Date(1000));
		expect(s.id).toBeGreaterThan(0);
		expect(s.startedAt).toBe(1000);
		expect(s.endedAt).toBeNull();
		expect(s.closeReason).toBeNull();
	});

	it('close() sets endedAt + closeReason and returns the row', () => {
		const s = repo.open(new Date(1000));
		const closed = repo.close(s.id, 'crashed', new Date(5000));
		expect(closed).not.toBeNull();
		expect(closed!.endedAt).toBe(5000);
		expect(closed!.closeReason).toBe('crashed');
	});

	it('close() defaults reason to null', () => {
		const s = repo.open(new Date(1000));
		const closed = repo.close(s.id, null, new Date(5000));
		expect(closed!.closeReason).toBeNull();
		expect(closed!.endedAt).toBe(5000);
	});

	it('closeDangling closes every open session', () => {
		repo.open(new Date(1000));
		repo.open(new Date(2000));
		repo.closeDangling(new Date(9000));
		const open = repo.listRecent(10).filter((r) => r.endedAt === null);
		expect(open.length).toBe(0);
	});

	it('closeDangling stamps endedAt from the last perf snapshot, falling back to the given time', () => {
		const withSnaps = repo.open(new Date(1000));
		const bare = repo.open(new Date(2000));
		perf.insert({ sessionId: withSnaps.id, ts: 60_000, players: 3, perf: {} });
		perf.insert({ sessionId: withSnaps.id, ts: 120_000, players: 2, perf: {} });

		repo.closeDangling(new Date(9_000_000));

		const stamped = repo.get(withSnaps.id)!;
		expect(stamped.endedAt).toBe(120_000);
		expect(stamped.closeReason).toBe('dangling');
		const fallback = repo.get(bare.id)!;
		expect(fallback.endedAt).toBe(9_000_000);
		expect(fallback.closeReason).toBe('dangling');
	});

	it('get returns a session or null', () => {
		const s = repo.open(new Date(1000));
		expect(repo.get(s.id)!.id).toBe(s.id);
		expect(repo.get(9999)).toBeNull();
	});

	it('listRecent returns newest first', () => {
		repo.open(new Date(1000));
		repo.open(new Date(3000));
		repo.open(new Date(2000));
		const list = repo.listRecent(10);
		expect(list.map((s) => s.startedAt)).toEqual([3000, 2000, 1000]);
	});

	it('prune removes closed sessions older than maxAge', () => {
		const old = repo.open(new Date(1000));
		repo.close(old.id, null, new Date(2000)); // ended in 1970
		const recent = repo.open();
		repo.close(recent.id);

		repo.prune(); // default 24h maxAge, keepLast 50

		const ids = repo.listRecent(100).map((s) => s.id);
		expect(ids).not.toContain(old.id);
		expect(ids).toContain(recent.id);
	});

	it('prune keeps only the newest keepLast closed sessions', () => {
		// closed recently (endedAt ~now) so the age-delete leaves them; keepLast trims
		for (let i = 1; i <= 5; i++) {
			const s = repo.open(new Date(i * 1000));
			repo.close(s.id, null, new Date());
		}

		repo.prune(24 * 60 * 60 * 1000, 2);

		const list = repo.listRecent(100);
		expect(list.length).toBe(2);
		expect(list.map((s) => s.startedAt)).toEqual([5000, 4000]);
	});

	it('prune never deletes a live (open) session, even beyond keepLast', () => {
		for (let i = 1; i <= 3; i++) {
			const s = repo.open(new Date(i * 1000));
			repo.close(s.id, null, new Date());
		}
		const live = repo.open(new Date(500)); // oldest start, still open

		repo.prune(24 * 60 * 60 * 1000, 1);

		const ids = repo.listRecent(100).map((s) => s.id);
		expect(ids).toContain(live.id);
	});
});
