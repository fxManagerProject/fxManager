/** biome-ignore-all lint/suspicious/noExplicitAny: clearing private singletons */
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../schema';
import { players, serverSessions } from '../schema';
import { migrations, runMigrations } from '../migrations';
import { createPlayerSessionsRepository } from './player-sessions';

describe('PlayerSessionsRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});
	let sqlite: Database;
	let db: ReturnType<typeof drizzle<typeof schema>>;
	let repo: ReturnType<typeof createPlayerSessionsRepository>;

	const seedPlayer = (name = 'Alice') =>
		db.insert(players).values({ name }).returning().get().id;

	beforeEach(() => {
		logSpy.mockClear();
		const zero = createPlayerSessionsRepository({} as any);
		(zero.constructor as any).instance = undefined;

		sqlite = new Database(':memory:');
		sqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(sqlite, migrations);
		db = drizzle(sqlite, { schema });
		repo = createPlayerSessionsRepository(db);
	});

	afterAll(() => logSpy.mockRestore());

	it('open() creates an in-progress row (null disconnect/duration)', () => {
		const pid = seedPlayer();
		const s = repo.open(pid, null, new Date(1_000_000));
		expect(s.connectedAt).toBe(1_000_000);
		expect(s.disconnectedAt).toBeNull();
		expect(s.durationMs).toBeNull();
	});

	it('close() sets disconnect + duration on the latest open row', () => {
		const pid = seedPlayer();
		repo.open(pid, null, new Date(1_000_000));
		const closed = repo.close(pid, 'quit', new Date(1_060_000))!;
		expect(closed.disconnectedAt).toBe(1_060_000);
		expect(closed.durationMs).toBe(60_000);
		expect(closed.endReason).toBe('quit');
	});

	it('close() returns null when the player has no open row', () => {
		const pid = seedPlayer();
		expect(repo.close(pid, 'quit')).toBeNull();
	});

	it('closeDangling() closes orphans using their server_session end time', () => {
		const pid = seedPlayer();
		const ss = db
			.insert(serverSessions)
			.values({ startedAt: new Date(1_000_000), endedAt: new Date(1_500_000) })
			.returning()
			.get();
		repo.open(pid, ss.id, new Date(1_000_000));
		repo.closeDangling(new Date(9_000_000));
		const [row] = repo.listSessions(pid, 1, 10).items;
		expect(row.disconnectedAt).toBe(1_500_000);
		expect(row.durationMs).toBe(500_000);
		expect(row.endReason).toBe('reconciled');
	});

	it('closeDangling() falls back to the provided time when no server session', () => {
		const pid = seedPlayer();
		repo.open(pid, null, new Date(1_000_000));
		repo.closeDangling(new Date(2_000_000));
		expect(repo.listSessions(pid, 1, 10).items[0].durationMs).toBe(1_000_000);
	});

	it('getRangeActivity() buckets playtime by start-day and summarises', () => {
		const pid = seedPlayer();
		// Two sessions same day, one another day, one outside the range.
		const day1a = new Date(2026, 6, 1, 10, 0);
		const day1b = new Date(2026, 6, 1, 20, 0);
		const day2 = new Date(2026, 6, 3, 12, 0);
		const outside = new Date(2026, 5, 1, 12, 0);
		for (const c of [day1a, day1b, day2, outside]) {
			repo.open(pid, null, c);
			repo.close(pid, 'quit', new Date(c.getTime() + 3_600_000)); // 1h each
		}
		const act = repo.getRangeActivity(
			pid,
			new Date(2026, 6, 1, 0, 0),
			new Date(2026, 6, 31, 23, 59),
		);
		expect(act.summary.daysActive).toBe(2);
		expect(act.summary.totalPlaytimeMs).toBe(3 * 3_600_000);
		expect(act.summary.longestSessionMs).toBe(3_600_000);
		const d1 = act.days.find((d) => d.date === '2026-07-01')!;
		expect(d1.playtimeMs).toBe(2 * 3_600_000);
		expect(d1.sessionCount).toBe(2);
	});

	it('listSessions() paginates newest-first with total', () => {
		const pid = seedPlayer();
		for (let i = 1; i <= 3; i++) {
			repo.open(pid, null, new Date(i * 1_000_000));
			repo.close(pid, 'quit', new Date(i * 1_000_000 + 1000));
		}
		const page = repo.listSessions(pid, 1, 2);
		expect(page.total).toBe(3);
		expect(page.items).toHaveLength(2);
		expect(page.items[0].connectedAt).toBe(3_000_000); // newest first
	});
});
