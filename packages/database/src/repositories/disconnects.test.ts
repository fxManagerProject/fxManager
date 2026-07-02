/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows clearing private singletons */
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { zeroDisconnectCounts } from '@fxmanager/shared/types';
import * as schema from '../schema';
import { migrations, runMigrations } from '../migrations';
import { createDisconnectsRepository } from './disconnects';
import { createServerSessionsRepository } from './server-sessions';

describe('DisconnectsRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let repo: ReturnType<typeof createDisconnectsRepository>;
	let sessions: ReturnType<typeof createServerSessionsRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		// Reset singleton cache instances to ensure total database isolation
		const zeroDisconnects = createDisconnectsRepository({} as any);
		(zeroDisconnects.constructor as any).instance = undefined;
		const zeroSessions = createServerSessionsRepository({} as any);
		(zeroSessions.constructor as any).instance = undefined;

		testSqlite = new Database(':memory:');
		testSqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		repo = createDisconnectsRepository(testDb);
		sessions = createServerSessionsRepository(testDb);
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	it('countsForSession tallies recorded events per category', () => {
		const s = sessions.open(new Date(1000));
		repo.recordEvent(s.id, 1000, 'quit');
		repo.recordEvent(s.id, 2000, 'crash');
		repo.recordEvent(s.id, 3000, 'quit');
		expect(repo.countsForSession(s.id)).toEqual({
			quit: 2,
			crash: 1,
			timeout: 0,
			kick: 0,
			other: 0,
		});
	});

	it('countsForSession returns zero counts for unknown or drop-free sessions', () => {
		const s = sessions.open(new Date(1000));
		expect(repo.countsForSession(s.id)).toEqual(zeroDisconnectCounts());
		expect(repo.countsForSession(999)).toEqual(zeroDisconnectCounts());
	});

	it('getForSession joins the session times with derived counts', () => {
		const s = sessions.open(new Date(1000));
		repo.recordEvent(s.id, 2000, 'kick');
		sessions.close(s.id, 'crashed', new Date(5000));
		const got = repo.getForSession(s.id)!;
		expect(got.startedAt).toBe(1000);
		expect(got.endedAt).toBe(5000);
		expect(got.kick).toBe(1);
		expect(got.quit + got.crash + got.timeout + got.other).toBe(0);
	});

	it('getForSession returns null for an unknown session', () => {
		expect(repo.getForSession(999)).toBeNull();
	});

	it('listRecent returns newest sessions first with derived counts', () => {
		const a = sessions.open(new Date(1000));
		const b = sessions.open(new Date(3000));
		const c = sessions.open(new Date(2000));
		repo.recordEvent(b.id, 3500, 'kick');
		const list = repo.listRecent(10);
		expect(list.map((s) => s.startedAt)).toEqual([3000, 2000, 1000]);
		expect(list[0].kick).toBe(1);
		expect(list.find((s) => s.id === a.id)!.kick).toBe(0);
		expect(list.find((s) => s.id === c.id)!.kick).toBe(0);
	});

	it('countsInRange only tallies events within [from, to]', () => {
		const s = sessions.open(new Date(1000));
		repo.recordEvent(s.id, 1000, 'quit');
		repo.recordEvent(s.id, 2000, 'quit');
		repo.recordEvent(s.id, 2000, 'crash');
		repo.recordEvent(s.id, 5000, 'kick'); // outside the window
		const counts = repo.countsInRange(s.id, 1500, 3000);
		expect(counts.quit).toBe(1);
		expect(counts.crash).toBe(1);
		expect(counts.kick).toBe(0);
	});
});
