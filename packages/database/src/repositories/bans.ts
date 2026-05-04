import { eq, and, isNull, or, gt } from 'drizzle-orm';
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

	revoke(banId: number) {
		return this.db
			.update(bans)
			.set({ revokedAt: new Date() })
			.where(eq(bans.id, banId))
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
}

export function createBansRepository(db: DB) {
	return BansRepository.getInstance(db);
}
