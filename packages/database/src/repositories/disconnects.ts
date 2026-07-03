import { and, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import {
	type DisconnectCounts,
	type DisconnectSession,
	type DropCategory,
	zeroDisconnectCounts,
} from '@fxmanager/shared/types';
import { disconnectEvents, serverSessions } from '../schema';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;
type SessionRow = typeof serverSessions.$inferSelect;

class DisconnectsRepository {
	private static instance: DisconnectsRepository;
	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): DisconnectsRepository {
		if (!DisconnectsRepository.instance) {
			DisconnectsRepository.instance = new DisconnectsRepository(db);
		}
		return DisconnectsRepository.instance;
	}

	/** Record one drop with its timestamp — the single source of truth. */
	recordEvent(sessionId: number, ts: number, category: DropCategory): void {
		this.db.insert(disconnectEvents).values({ sessionId, ts, category }).run();
	}

	private tally(where: SQL | undefined): DisconnectCounts {
		const rows = this.db
			.select({ category: disconnectEvents.category, c: count() })
			.from(disconnectEvents)
			.where(where)
			.groupBy(disconnectEvents.category)
			.all();

		const out = zeroDisconnectCounts();
		for (const row of rows) {
			if (row.category in out) out[row.category as DropCategory] = row.c;
		}
		return out;
	}

	/** Category tallies for one session (the whole-session total). */
	countsForSession(sessionId: number): DisconnectCounts {
		return this.tally(eq(disconnectEvents.sessionId, sessionId));
	}

	/** Category tallies for drops within [from, to] of a session. */
	countsInRange(sessionId: number, from: number, to: number): DisconnectCounts {
		return this.tally(
			and(
				eq(disconnectEvents.sessionId, sessionId),
				gte(disconnectEvents.ts, from),
				lte(disconnectEvents.ts, to),
			),
		);
	}

	private toApi(session: SessionRow): DisconnectSession {
		return {
			id: session.id,
			startedAt: session.startedAt.getTime(),
			endedAt: session.endedAt ? session.endedAt.getTime() : null,
			...this.countsForSession(session.id),
		};
	}

	getForSession(sessionId: number): DisconnectSession | null {
		const row = this.db
			.select()
			.from(serverSessions)
			.where(eq(serverSessions.id, sessionId))
			.get();
		return row ? this.toApi(row) : null;
	}

	listRecent(limit = 30): DisconnectSession[] {
		return this.db
			.select()
			.from(serverSessions)
			.orderBy(desc(serverSessions.startedAt))
			.limit(limit)
			.all()
			.map((row) => this.toApi(row));
	}
}

export function createDisconnectsRepository(db: DB) {
	return DisconnectsRepository.getInstance(db);
}
