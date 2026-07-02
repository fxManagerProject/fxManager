import {
	and,
	desc,
	eq,
	isNotNull,
	isNull,
	lt,
	max,
	notInArray,
} from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { ServerSession } from '@fxmanager/shared/types';
import { perfSnapshots, serverSessions } from '../schema';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;
type Row = typeof serverSessions.$inferSelect;

const toApi = (row: Row): ServerSession => ({
	id: row.id,
	startedAt: row.startedAt.getTime(),
	endedAt: row.endedAt ? row.endedAt.getTime() : null,
	closeReason: row.closeReason,
});

class ServerSessionsRepository {
	private static instance: ServerSessionsRepository;
	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): ServerSessionsRepository {
		if (!ServerSessionsRepository.instance) {
			ServerSessionsRepository.instance = new ServerSessionsRepository(db);
		}
		return ServerSessionsRepository.instance;
	}

	open(startedAt = new Date()): ServerSession {
		const row = this.db
			.insert(serverSessions)
			.values({ startedAt })
			.returning()
			.get();
		return toApi(row);
	}

	close(
		id: number,
		reason: string | null = null,
		endedAt = new Date(),
	): ServerSession | null {
		this.db
			.update(serverSessions)
			.set({ endedAt, closeReason: reason })
			.where(eq(serverSessions.id, id))
			.run();
		return this.get(id);
	}

	closeDangling(endedAt = new Date()): void {
		const dangling = this.db
			.select({ id: serverSessions.id })
			.from(serverSessions)
			.where(isNull(serverSessions.endedAt))
			.all();

		for (const { id } of dangling) {
			const last = this.db
				.select({ ts: max(perfSnapshots.ts) })
				.from(perfSnapshots)
				.where(eq(perfSnapshots.sessionId, id))
				.get();
			this.db
				.update(serverSessions)
				.set({
					endedAt: last?.ts ? new Date(last.ts) : endedAt,
					closeReason: 'dangling',
				})
				.where(eq(serverSessions.id, id))
				.run();
		}
	}

	get(id: number): ServerSession | null {
		const row = this.db
			.select()
			.from(serverSessions)
			.where(eq(serverSessions.id, id))
			.get();
		return row ? toApi(row) : null;
	}

	listRecent(limit = 50): ServerSession[] {
		return this.db
			.select()
			.from(serverSessions)
			.orderBy(desc(serverSessions.startedAt))
			.limit(limit)
			.all()
			.map(toApi);
	}

	prune(maxAgeMs = 24 * 60 * 60 * 1000, keepLast = 50): void {
		const cutoff = new Date(Date.now() - maxAgeMs);

		this.db
			.delete(serverSessions)
			.where(
				and(
					isNotNull(serverSessions.endedAt),
					lt(serverSessions.endedAt, cutoff),
				),
			)
			.run();

		const keepIds = this.db
			.select({ id: serverSessions.id })
			.from(serverSessions)
			.orderBy(desc(serverSessions.startedAt), desc(serverSessions.id))
			.limit(keepLast);

		// Never prune a live session (ended_at IS NULL), regardless of caller.
		this.db
			.delete(serverSessions)
			.where(
				and(
					isNotNull(serverSessions.endedAt),
					notInArray(serverSessions.id, keepIds),
				),
			)
			.run();
	}
}

export function createServerSessionsRepository(db: DB) {
	return ServerSessionsRepository.getInstance(db);
}
