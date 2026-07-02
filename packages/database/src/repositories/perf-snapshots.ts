import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { perfSnapshots } from '../schema';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;

class PerfSnapshotsRepository {
	private static instance: PerfSnapshotsRepository;
	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): PerfSnapshotsRepository {
		if (!PerfSnapshotsRepository.instance) {
			PerfSnapshotsRepository.instance = new PerfSnapshotsRepository(db);
		}
		return PerfSnapshotsRepository.instance;
	}

	insert(row: {
		sessionId: number;
		ts: number;
		players: number;
		fxsMemory?: number | null;
		nodeMemory?: number | null;
		perf: unknown;
	}): void {
		this.db
			.insert(perfSnapshots)
			.values({
				sessionId: row.sessionId,
				ts: row.ts,
				players: row.players,
				fxsMemory: row.fxsMemory ?? null,
				nodeMemory: row.nodeMemory ?? null,
				perf: row.perf,
			})
			.run();
	}

	listForSession(
		sessionId: number,
		opts: { from?: number; to?: number; limit?: number } = {},
	): Array<{
		ts: number;
		players: number;
		fxsMemory: number | null;
		nodeMemory: number | null;
		perf: unknown;
	}> {
		const conditions = [eq(perfSnapshots.sessionId, sessionId)];
		if (opts.from !== undefined)
			conditions.push(gte(perfSnapshots.ts, opts.from));
		if (opts.to !== undefined) conditions.push(lte(perfSnapshots.ts, opts.to));

		const query = this.db
			.select({
				ts: perfSnapshots.ts,
				players: perfSnapshots.players,
				fxsMemory: perfSnapshots.fxsMemory,
				nodeMemory: perfSnapshots.nodeMemory,
				perf: perfSnapshots.perf,
			})
			.from(perfSnapshots)
			.where(and(...conditions));

		if (opts.limit !== undefined) {
			return query
				.orderBy(desc(perfSnapshots.ts))
				.limit(opts.limit)
				.all()
				.reverse();
		}
		return query.orderBy(asc(perfSnapshots.ts)).all();
	}
}

export function createPerfSnapshotsRepository(db: DB) {
	return PerfSnapshotsRepository.getInstance(db);
}
