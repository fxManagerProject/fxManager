import { eq, isNull } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { apiTokens } from '../schema';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;

class APITokensRepository {
	private static instance: APITokensRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): APITokensRepository {
		if (!APITokensRepository.instance) {
			APITokensRepository.instance = new APITokensRepository(db);
		}

		return APITokensRepository.instance;
	}

	create(name: string) {
		const token = `fp_${crypto.randomUUID().replace(/-/g, '')}`;
		return this.db
			.insert(apiTokens)
			.values({ name, token, createdAt: new Date() })
			.returning()
			.get();
	}

	validate(token: string) {
		const row = this.db
			.select()
			.from(apiTokens)
			.where(eq(apiTokens.token, token))
			.get();

		if (!row || row.revokedAt) return null;

		// Update lastUsed async — fire and forget
		this.db
			.update(apiTokens)
			.set({ lastUsed: new Date() })
			.where(eq(apiTokens.id, row.id))
			.run();

		return row;
	}

	revoke(id: number) {
		return this.db
			.update(apiTokens)
			.set({ revokedAt: new Date() })
			.where(eq(apiTokens.id, id))
			.returning()
			.get();
	}

	list() {
		return this.db
			.select()
			.from(apiTokens)
			.where(isNull(apiTokens.revokedAt))
			.all();
	}
}

export function createApiTokensRepository(db: DB) {
	return APITokensRepository.getInstance(db);
}
