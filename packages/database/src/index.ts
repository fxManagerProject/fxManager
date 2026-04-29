import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database, type SQLiteError } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';
import { migrations, runMigrations } from './migrations';
import { createPlayersRepository } from './repositories/players';
import { createBansRepository } from './repositories/bans';
import { createAuditRepository } from './repositories/audit';
import { createSettingsRepository } from './repositories/settings';
import { createApiTokensRepository } from './repositories/api-tokens';
import { createAuthRepository } from './repositories/auth';

export type { Migration } from './migrations/types';

// ─── Initialise ───────────────────────────────────────────────────────────────

const dbPath =
	process.env.NODE_ENV === 'production'
		? './data/panel.db'
		: '../../data/panel.db';
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

export const sqlite = new Database(dbPath);

// when the sqlite file gets built for the first time, it can be locked for a period of time
// this seems to occur mainly during delopment and not in production so we use a retry system
let success = false;
for (let attempt = 0; attempt < 5; attempt++) {
	try {
		// WAL mode — safe concurrent reads between core and panel
		sqlite.run('PRAGMA journal_mode = WAL;');
		sqlite.run('PRAGMA foreign_keys = ON;');
		sqlite.run('PRAGMA busy_timeout = 5000;');

		success = true;

		break;
	} catch (err) {
		if ((err as SQLiteError).code === 'SQLITE_BUSY') {
			console.warn(
				`[database] failed to initialze sqlite db (attempt ${attempt + 1}), retrying`,
			);
			Bun.sleepSync(1_000);
		} else {
			throw err;
		}
	}
}

if (!success)
	throw new Error('Database was unable to initialize after 5 tries !');
else console.info(`[database] connection established.`);

export const db = drizzle(sqlite, { schema });

// ─── Migrations ───────────────────────────────────────────────────────────────
// Version-based, TS-native — no migration files, no drizzle-kit at runtime.
// To add a migration: edit packages/database/src/migrations/index.ts

export function applyMigrations() {
	runMigrations(sqlite, migrations);
}

// ─── Repositories ─────────────────────────────────────────────────────────────

export const repo = {
	players: createPlayersRepository(db),
	bans: createBansRepository(db),
	audit: createAuditRepository(db),
	settings: createSettingsRepository(db),
	apiTokens: createApiTokensRepository(db),
	auth: createAuthRepository(db),
};
