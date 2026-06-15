import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type * as schema from '../schema';
import { parseTxAdminDb } from '../import/txadmin';
import { importTxAdmin, type ImportSummary } from '../import/txadmin.importer';

type DB = BunSQLiteDatabase<typeof schema>;

class MigrateRepository {
	constructor(private readonly db: DB) {}

	fromTxAdmin(raw: unknown): ImportSummary {
		const parsed = parseTxAdminDb(raw);
		return importTxAdmin(this.db, parsed);
	}
}

export function createMigrateRepository(db: DB) {
	return new MigrateRepository(db);
}
