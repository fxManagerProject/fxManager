import {
	type SQL,
	and,
	count,
	desc,
	eq,
	gte,
	like,
	lte,
	or,
	sql,
} from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { eventLogs } from '../schema';
import type * as schema from '../schema';
import type { EventLogEntry } from '@fxmanager/shared/types';

type DB = BunSQLiteDatabase<typeof schema>;

export interface EventLogInsert {
	event: string;
	timestamp?: number;
	playerId?: number | null;
	playerName?: string | null;
	serverSessionId?: number | null;
	data?: Record<string, unknown>;
}

export interface EventLogQuery {
	page?: number;
	pageSize?: number;
	/** Filter by event type (partial match) */
	event?: string;
	/** Filter by player name or ID (partial match) */
	player?: string;
	/** Filter by exact event types */
	eventTypes?: string[];
	/** Unix timestamp lower bound */
	from?: number;
	/** Unix timestamp upper bound */
	to?: number;
	/** Server session scope */
	serverSessionId?: number;
}

/** Round-trip DB row → shared type */
function toEntry(row: typeof eventLogs.$inferSelect): EventLogEntry {
	return {
		id: String(row.id),
		event: row.event,
		timestamp: row.timestamp,
		playerId: row.playerId ?? undefined,
		playerName: row.playerName ?? undefined,
		data: row.data ?? {},
	};
}

class EventLogsRepository {
	private static instance: EventLogsRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): EventLogsRepository {
		if (!EventLogsRepository.instance) {
			EventLogsRepository.instance = new EventLogsRepository(db);
		}
		return EventLogsRepository.instance;
	}

	/** Insert a single event log entry. Returns the created entry. */
	insert(input: EventLogInsert): EventLogEntry {
		const row = this.db
			.insert(eventLogs)
			.values({
				event: input.event,
				timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
				playerId: input.playerId ?? null,
				playerName: input.playerName ?? null,
				serverSessionId: input.serverSessionId ?? null,
				data: input.data ?? {},
			})
			.returning()
			.get();
		return toEntry(row);
	}

	/** Bulk-insert multiple event log entries. Returns the created entries. */
	insertBatch(inputs: EventLogInsert[]): EventLogEntry[] {
		if (inputs.length === 0) return [];
		const rows = this.db
			.insert(eventLogs)
			.values(
				inputs.map((i) => ({
					event: i.event,
					timestamp: i.timestamp ?? Math.floor(Date.now() / 1000),
					playerId: i.playerId ?? null,
					playerName: i.playerName ?? null,
					serverSessionId: i.serverSessionId ?? null,
					data: i.data ?? {},
				})),
			)
			.returning()
			.all();
		return rows.map(toEntry);
	}

	/** Get the most recent N entries (for initial WS snapshot). */
	getRecent(limit = 500): EventLogEntry[] {
		const rows = this.db
			.select()
			.from(eventLogs)
			.orderBy(desc(eventLogs.timestamp), desc(eventLogs.id))
			.limit(limit)
			.all();
		return rows.reverse().map(toEntry);
	}

	/** Get entries since a given timestamp (for catch-up after reconnect). */
	getSince(since: number, limit = 1000): EventLogEntry[] {
		const rows = this.db
			.select()
			.from(eventLogs)
			.where(gte(eventLogs.timestamp, since))
			.orderBy(desc(eventLogs.timestamp), desc(eventLogs.id))
			.limit(limit)
			.all();
		return rows.reverse().map(toEntry);
	}

	/** Query with full filtering and pagination. */
	query({
		page = 1,
		pageSize = 50,
		event,
		player,
		eventTypes,
		from,
		to,
		serverSessionId,
	}: EventLogQuery = {}) {
		const offset = (page - 1) * pageSize;
		const conditions: SQL<unknown>[] = [];

		if (event) {
			conditions.push(like(eventLogs.event, `%${event}%`));
		}

		if (player) {
			conditions.push(
				or(
					like(eventLogs.playerName, `%${player}%`),
					sql`CAST(${eventLogs.playerId} AS TEXT) LIKE ${`%${player}%`}`,
				)!,
			);
		}

		if (eventTypes && eventTypes.length > 0) {
			conditions.push(or(...eventTypes.map((et) => eq(eventLogs.event, et)))!);
		}

		if (from !== undefined) {
			conditions.push(gte(eventLogs.timestamp, from));
		}
		if (to !== undefined) {
			conditions.push(lte(eventLogs.timestamp, to));
		}

		if (serverSessionId !== undefined) {
			conditions.push(eq(eventLogs.serverSessionId, serverSessionId));
		}

		// Build items query
		const baseItems = this.db
			.select()
			.from(eventLogs)
			.orderBy(desc(eventLogs.timestamp), desc(eventLogs.id))
			.limit(pageSize)
			.offset(offset);

		const items = (
			conditions.length > 0 ? baseItems.where(and(...conditions)!) : baseItems
		)
			.all()
			.map(toEntry);

		// Build count query
		const baseCount = this.db.select({ c: count() }).from(eventLogs);

		const total =
			(conditions.length > 0
				? baseCount.where(and(...conditions)!)
				: baseCount
			).get()?.c ?? 0;

		return { items, total, page, pageSize };
	}

	/** Returns unique event type names seen in the log (for filter suggestions). */
	getEventTypes(limit = 100): string[] {
		const rows = this.db
			.selectDistinct({ event: eventLogs.event })
			.from(eventLogs)
			.orderBy(eventLogs.event)
			.limit(limit)
			.all();
		return rows.map((r) => r.event);
	}
}

export function createEventLogsRepository(db: DB) {
	return EventLogsRepository.getInstance(db);
}
