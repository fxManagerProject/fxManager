import { eq, and, isNull, or, gt, desc, like } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { bans, players, playerIdentifiers } from '../schema';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;

class BansRepository {
	private static instance: BansRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): BansRepository {
		if (!BansRepository.instance) {
			BansRepository.instance = new BansRepository(db);
		}

		return BansRepository.instance;
	}

	create(input: {
		playerId: number;
		reason: string;
		bannedBy: string;
		expiresAt?: Date;
	}) {
		return this.db
			.insert(bans)
			.values({ ...input, createdAt: new Date() })
			.returning()
			.get();
	}

	revoke(banId: number, playerId?: number) {
		return this.db
			.update(bans)
			.set({ revokedAt: new Date() })
			.where(
				and(
					eq(bans.id, banId),
					isNull(bans.revokedAt),
					playerId !== undefined ? eq(bans.playerId, playerId) : undefined,
				),
			)
			.returning()
			.get();
	}

	// ToDo: update to check across multiple identifiers and also HWIDS
	isLicenseBanned(license: string): boolean {
		const now = new Date();
		const result = this.db
			.select({ banId: bans.id })
			.from(bans)
			.innerJoin(players, eq(bans.playerId, players.id))
			.innerJoin(playerIdentifiers, eq(playerIdentifiers.playerId, players.id))
			.where(
				and(
					eq(playerIdentifiers.type, 'license'),
					eq(playerIdentifiers.value, license),
					isNull(bans.revokedAt),
					or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
				),
			)
			.get();
		return !!result;
	}

	list(page = 1, pageSize = 50) {
		return this.db
			.select()
			.from(bans)
			.innerJoin(players, eq(bans.playerId, players.id))
			.orderBy(bans.createdAt)
			.limit(pageSize)
			.offset((page - 1) * pageSize)
			.all();
	}

	search(opts?: { query?: string; page?: number; pageSize?: number }) {
		const { query, page = 1, pageSize = 50 } = opts ?? {};

		const base = this.db
			.select({
				id: bans.id,
				playerId: bans.playerId,
				name: players.name,
				reason: bans.reason,
				issuer: bans.issuer,
				createdAt: bans.createdAt,
				expiresAt: bans.expiresAt,
				revokedAt: bans.revokedAt,
			})
			.from(bans)
			.innerJoin(players, eq(bans.playerId, players.id))
			.$dynamic();

		const filtered = query
			? base
					.leftJoin(
						playerIdentifiers,
						eq(playerIdentifiers.playerId, players.id),
					)
					.where(
						or(
							like(players.name, `%${query}%`),
							like(playerIdentifiers.value, `%${query}%`),
							like(bans.reason, `%${query}%`),
						),
					)
					.groupBy(bans.id)
			: base;

		return filtered
			.orderBy(desc(bans.createdAt))
			.limit(pageSize)
			.offset((page - 1) * pageSize)
			.all();
	}
}

export function createBansRepository(db: DB) {
	return BansRepository.getInstance(db);
}
