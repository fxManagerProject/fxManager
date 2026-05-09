import { eq, or } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { whitelistedIdentifers } from '../schema';
import type * as schema from '../schema';
import type { PlayerIdentifiers } from '@fxmanager/shared/types';

type DB = BunSQLiteDatabase<typeof schema>;

class WhitelistRepository {
	private static instance: WhitelistRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): WhitelistRepository {
		if (!WhitelistRepository.instance) {
			WhitelistRepository.instance = new WhitelistRepository(db);
		}

		return WhitelistRepository.instance;
	}

	async isAnyIdentifierWhitelisted(
		identifiers: PlayerIdentifiers,
	): Promise<boolean> {
		const conditions = [eq(whitelistedIdentifers.value, identifiers.license)];

		if (identifiers.fivem) {
			conditions.push(eq(whitelistedIdentifers.value, identifiers.fivem));
		}
		if (identifiers.discord) {
			conditions.push(eq(whitelistedIdentifers.value, identifiers.discord));
		}
		if (identifiers.steam) {
			conditions.push(eq(whitelistedIdentifers.value, identifiers.steam));
		}

		const result = await this.db
			.select({ id: whitelistedIdentifers.id })
			.from(whitelistedIdentifers)
			.where(or(...conditions))
			.limit(1);

		return result.length > 0;
	}
}

export function createWhitelistRepository(db: DB) {
	return WhitelistRepository.getInstance(db);
}
