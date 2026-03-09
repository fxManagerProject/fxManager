import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import * as schema from './schema';
import { runMigrations } from './migrations/runner';
import { migrations } from './migrations/index';
import { createPlayersRepository } from './repositories/players';
import { createBansRepository } from './repositories/bans';
import { createAuditRepository } from './repositories/audit';
import { createSettingsRepository } from './repositories/settings';
import { createApiTokensRepository } from './repositories/api-tokens';
import { createAuthRepository } from './repositories/auth';

export * from './schema';
export type { Migration } from './migrations/types';

// ─── Initialise ───────────────────────────────────────────────────────────────

const dbPath = process.env.NODE_ENV === 'production' ? './data/panel.db' : '../../data/panel.db';
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

export const sqlite = new Database(dbPath);

// WAL mode — safe concurrent reads between core and panel
sqlite.run('PRAGMA journal_mode = WAL;');
sqlite.run('PRAGMA foreign_keys = ON;');
sqlite.run('PRAGMA busy_timeout = 5000;');

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
  auth:      createAuthRepository(db),
};
