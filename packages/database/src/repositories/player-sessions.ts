import {
	and,
	count,
	desc,
	eq,
	gte,
	isNotNull,
	isNull,
	lte,
} from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type {
	PaginatedResponse,
	PlayerActivity,
	PlayerSession,
} from '@fxmanager/shared/types';
import { playerSessions, serverSessions } from '../schema';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;
type Row = typeof playerSessions.$inferSelect;

const pad = (n: number) => String(n).padStart(2, '0');
const localDateKey = (d: Date) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const toApi = (row: Row): PlayerSession => ({
	id: row.id,
	connectedAt: row.connectedAt.getTime(),
	disconnectedAt: row.disconnectedAt ? row.disconnectedAt.getTime() : null,
	durationMs: row.durationMs,
	endReason: row.endReason,
});

class PlayerSessionsRepository {
	private static instance: PlayerSessionsRepository;
	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): PlayerSessionsRepository {
		if (!PlayerSessionsRepository.instance) {
			PlayerSessionsRepository.instance = new PlayerSessionsRepository(db);
		}
		return PlayerSessionsRepository.instance;
	}

	open(
		playerId: number,
		serverSessionId: number | null,
		connectedAt = new Date(),
	): PlayerSession {
		const row = this.db
			.insert(playerSessions)
			.values({ playerId, serverSessionId, connectedAt })
			.returning()
			.get();
		return toApi(row);
	}

	close(
		playerId: number,
		endReason: string | null = null,
		disconnectedAt = new Date(),
	): PlayerSession | null {
		const open = this.db
			.select()
			.from(playerSessions)
			.where(
				and(
					eq(playerSessions.playerId, playerId),
					isNull(playerSessions.disconnectedAt),
				),
			)
			.orderBy(desc(playerSessions.connectedAt), desc(playerSessions.id))
			.limit(1)
			.get();
		if (!open) return null;

		const durationMs = Math.max(
			0,
			disconnectedAt.getTime() - open.connectedAt.getTime(),
		);
		this.db
			.update(playerSessions)
			.set({ disconnectedAt, durationMs, endReason })
			.where(eq(playerSessions.id, open.id))
			.run();
		return this.get(open.id);
	}

	/** Close crash/restart orphans (endedAt null) using their server session's end. */
	closeDangling(fallbackEndedAt = new Date()): void {
		const dangling = this.db
			.select()
			.from(playerSessions)
			.where(isNull(playerSessions.disconnectedAt))
			.all();

		for (const row of dangling) {
			const ss = row.serverSessionId
				? this.db
						.select()
						.from(serverSessions)
						.where(eq(serverSessions.id, row.serverSessionId))
						.get()
				: null;
			const endedAt = ss?.endedAt ?? fallbackEndedAt;
			const durationMs = Math.max(
				0,
				endedAt.getTime() - row.connectedAt.getTime(),
			);
			this.db
				.update(playerSessions)
				.set({ disconnectedAt: endedAt, durationMs, endReason: 'reconciled' })
				.where(eq(playerSessions.id, row.id))
				.run();
		}
	}

	get(id: number): PlayerSession | null {
		const row = this.db
			.select()
			.from(playerSessions)
			.where(eq(playerSessions.id, id))
			.get();
		return row ? toApi(row) : null;
	}

	/** Day-bucketed playtime + summary over [from, to], attributed to start-day. */
	getRangeActivity(playerId: number, from: Date, to: Date): PlayerActivity {
		const rows = this.db
			.select()
			.from(playerSessions)
			.where(
				and(
					eq(playerSessions.playerId, playerId),
					gte(playerSessions.connectedAt, from),
					lte(playerSessions.connectedAt, to),
					isNotNull(playerSessions.durationMs),
				),
			)
			.all();

		const byDay = new Map<string, { playtimeMs: number; sessionCount: number }>();
		let total = 0;
		let longest = 0;
		for (const r of rows) {
			const key = localDateKey(r.connectedAt);
			const b = byDay.get(key) ?? { playtimeMs: 0, sessionCount: 0 };
			const d = r.durationMs ?? 0;
			b.playtimeMs += d;
			b.sessionCount += 1;
			byDay.set(key, b);
			total += d;
			if (d > longest) longest = d;
		}

		const days = [...byDay.entries()]
			.map(([date, v]) => ({ date, ...v }))
			.sort((a, b) => a.date.localeCompare(b.date));

		return {
			from: localDateKey(from),
			to: localDateKey(to),
			days,
			summary: {
				daysActive: byDay.size,
				totalPlaytimeMs: total,
				longestSessionMs: longest,
				avgSessionMs: rows.length ? Math.round(total / rows.length) : 0,
			},
		};
	}

	listSessions(
		playerId: number,
		page = 1,
		pageSize = 25,
	): PaginatedResponse<PlayerSession> {
		const offset = (page - 1) * pageSize;
		const items = this.db
			.select()
			.from(playerSessions)
			.where(eq(playerSessions.playerId, playerId))
			.orderBy(desc(playerSessions.connectedAt), desc(playerSessions.id))
			.limit(pageSize)
			.offset(offset)
			.all()
			.map(toApi);
		const total =
			this.db
				.select({ c: count() })
				.from(playerSessions)
				.where(eq(playerSessions.playerId, playerId))
				.get()?.c ?? 0;
		return { items, total, page, pageSize };
	}
}

export function createPlayerSessionsRepository(db: DB) {
	return PlayerSessionsRepository.getInstance(db);
}
