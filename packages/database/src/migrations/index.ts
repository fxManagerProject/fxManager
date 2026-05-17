import type { Database } from 'bun:sqlite';
import type { Migration } from './types';

export * from './migrations';

// region version tables
// bootstrap the version tracking table
// This is the only table created outside the migration system itself.

function ensureVersionTable(sqlite: Database) {
	sqlite.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER NOT NULL,
      description TEXT    NOT NULL,
      applied_at  INTEGER NOT NULL
    )
  `);
}

function getCurrentVersion(sqlite: Database): number {
	const row = sqlite
		.query<{ version: number }, []>(
			'SELECT MAX(version) as version FROM schema_version',
		)
		.get();
	return row?.version ?? -1;
}

// region runner

export function runMigrations(sqlite: Database, migrations: Migration[]) {
	ensureVersionTable(sqlite);

	const current = getCurrentVersion(sqlite);
	const pending = migrations
		.filter((m) => m.version > current)
		.sort((a, b) => a.version - b.version);

	if (pending.length === 0) {
		console.log(`[database] Schema up to date (v${current})`);
		return;
	}

	for (const migration of pending) {
		console.log(
			`[database] Applying migration v${migration.version}: ${migration.description}`,
		);

		sqlite.run('BEGIN');
		try {
			for (const statement of migration.up) {
				sqlite.run(statement);
			}
			sqlite.run(
				'INSERT INTO schema_version (version, description, applied_at) VALUES (?, ?, ?)',
				[migration.version, migration.description, Date.now()],
			);
			sqlite.run('COMMIT');
		} catch (err) {
			sqlite.run('ROLLBACK');
			throw new Error(
				`[database] Migration v${migration.version} failed: ${(err as Error).message}`,
			);
		}
	}

	const latest = pending.at(-1);
	console.log(
		`[database] Migrated to v${latest?.version ?? 'UNK'} (${pending.length} applied)`,
	);
}
