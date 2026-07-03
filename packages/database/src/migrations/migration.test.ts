import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { runMigrations } from './index'; // Adjust path to migrations/index.ts
import { migrations as prodMigrations } from './migrations'; // Import production migrations array
import type { Migration } from './types';

describe('Database Migration Runner', () => {
	let testSqlite: Database;

	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	beforeEach(() => {
		// Provide a completely fresh, isolated in-memory database for every test case
		testSqlite = new Database(':memory:');
		logSpy.mockClear();
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	// Helper utility to easily query internal schema_version tracking rows
	const getTrackedVersions = (sqlite: Database) => {
		return sqlite
			.query<{ version: number; description: string; applied_at: number }, []>(
				'SELECT version, description, applied_at FROM schema_version ORDER BY version ASC',
			)
			.all();
	};

	describe('ensureVersionTable()', () => {
		it('should bootstrap the schema_version tracking table on initialization', () => {
			const mockMigrations: Migration[] = [];

			runMigrations(testSqlite, mockMigrations);

			// Verify the table actually exists by inspecting SQLite master catalogs
			const tableCheck = testSqlite
				.query<{ name: string }, []>(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'",
				)
				.get();

			expect(tableCheck).toBeDefined();
			expect(tableCheck?.name).toBe('schema_version');
		});
	});

	describe('Sequential Execution & State Tracking', () => {
		it('should apply pending migrations sequentially in ascending order and track them accurately', () => {
			// Define mock migrations intentionally out of array order to verify sorting logic
			const mockMigrations: Migration[] = [
				{
					version: 2,
					description: 'Create logs table',
					up: ['CREATE TABLE logs (id INTEGER PRIMARY KEY, message TEXT);'],
				},
				{
					version: 1,
					description: 'Create users table',
					up: ['CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);'],
				},
			];

			runMigrations(testSqlite, mockMigrations);

			// Verify that tables from both migrations are now live
			const tables = testSqlite
				.query<{ name: string }, []>(
					"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'logs')",
				)
				.all();
			expect(tables.length).toBe(2);

			// Assert that migrations were tracked and documented chronologically by version number
			const history = getTrackedVersions(testSqlite);
			expect(history.length).toBe(2);
			expect(history[0].version).toBe(1);
			expect(history[0].description).toBe('Create users table');
			expect(history[1].version).toBe(2);
			expect(history[1].description).toBe('Create logs table');
		});

		it('should gracefully perform a no-op if the database is already fully up-to-date', () => {
			const mockMigrations: Migration[] = [
				{
					version: 1,
					description: 'Initial Setup',
					up: ['CREATE TABLE dummy (id INT);'],
				},
			];

			// Run it the first time to bring version state to v1
			runMigrations(testSqlite, mockMigrations);
			expect(logSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('Schema up to date'),
			);

			// Run it a second time with the same array context
			runMigrations(testSqlite, mockMigrations);

			expect(logSpy).toHaveBeenCalledWith('[database] Schema up to date (v1)');
		});

		it('should only execute pending migrations that are strictly greater than the current version', () => {
			runMigrations(testSqlite, [
				{
					version: 1,
					description: 'Migration V1',
					up: ['CREATE TABLE t1 (id INT);'],
				},
			]);

			const updatedBatch: Migration[] = [
				{
					version: 1,
					description: 'Migration V1 modified',
					up: ['CREATE TABLE should_not_run (id INT);'],
				},
				{
					version: 2,
					description: 'Migration V2',
					up: ['CREATE TABLE t2 (id INT);'],
				},
			];

			runMigrations(testSqlite, updatedBatch);

			const t2Check = testSqlite
				.query("SELECT name FROM sqlite_master WHERE name='t2'")
				.get();
			expect(t2Check).toBeDefined();

			// Verify V1 was completely skipped (its modified structural query was never invoked)
			const invalidCheck = testSqlite
				.query("SELECT name FROM sqlite_master WHERE name='should_not_run'")
				.get();
			expect(invalidCheck).toBeNull();
		});
	});

	describe('Transactional Fault Tolerance', () => {
		it('should atomicly rollback a partial migration if an internal query statement throws a syntax/runtime error', () => {
			const faultyMigration: Migration[] = [
				{
					version: 1,
					description: 'Atomic Rollback Test',
					up: [
						'CREATE TABLE successfully_created (id INTEGER PRIMARY KEY);',
						'INSERT INTO non_existent_table VALUES (1, 2, 3);',
					],
				},
			];

			expect(() => runMigrations(testSqlite, faultyMigration)).toThrow(
				/\[database\] Migration v1 failed/,
			);

			// SQLite supports transactional DDL operations. Because the second query threw,
			// the first statement ('CREATE TABLE successfully_created') MUST be rolled back entirely.
			const tableCheck = testSqlite
				.query<{ name: string }, []>(
					"SELECT name FROM sqlite_master WHERE name='successfully_created'",
				)
				.get();
			expect(tableCheck).toBeNull();

			// Ensure the bad migration version number was NEVER appended to tracking collections
			const history = getTrackedVersions(testSqlite);
			expect(history.length).toBe(0);
		});
	});

	describe('m0006 admin groups backfill', () => {
		it('should assign groups on exact bitmask match, clear their bitmask and leave master/custom admins untouched', () => {
			runMigrations(
				testSqlite,
				prodMigrations.filter((m) => m.version < 6),
			);

			testSqlite.run(
				`INSERT INTO admin_users (username, password_hash, permissions, created_at) VALUES
				('master', 'h', 1073741824, 0),
				('mod', 'h', 1991, 0),
				('mod_plus', 'h', ${1991 | 2048}, 0),
				('nobody', 'h', 0, 0)`,
			);

			runMigrations(testSqlite, prodMigrations);

			const admins = testSqlite
				.query<
					{ username: string; permissions: number; group_id: number | null },
					[]
				>('SELECT username, permissions, group_id FROM admin_users')
				.all();
			const byName = new Map(admins.map((a) => [a.username, a]));
			const moderation = testSqlite
				.query<{ id: number }, []>(
					"SELECT id FROM admin_groups WHERE name = 'Moderation'",
				)
				.get();

			expect(byName.get('master')).toMatchObject({
				permissions: 1073741824,
				group_id: null,
			});
			expect(byName.get('mod')).toMatchObject({
				permissions: 0,
				group_id: moderation?.id,
			});
			// customized bitmasks stay ungrouped so no permissions are lost
			expect(byName.get('mod_plus')).toMatchObject({
				permissions: 1991 | 2048,
				group_id: null,
			});
			expect(byName.get('nobody')).toMatchObject({
				permissions: 0,
				group_id: null,
			});
		});
	});

	describe('Production Migration Registry Verification', () => {
		it('should cleanly apply all active production migrations sequentially without encountering errors', () => {
			// This validates that every SQL file currently written in packages/database/src/migrations/
			// has correct syntax, valid table constraints, and no foreign key execution errors.
			expect(() => {
				runMigrations(testSqlite, prodMigrations);
			}).not.toThrow();

			const history = getTrackedVersions(testSqlite);
			expect(history.length).toBe(prodMigrations.length);

			if (prodMigrations.length > 0) {
				const expectedMaxVersion = Math.max(
					...prodMigrations.map((m) => m.version),
				);
				expect(history.at(-1)?.version).toBe(expectedMaxVersion);
			}
		});
	});
});
