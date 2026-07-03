/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows clearing private singletons */
import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';

import * as schema from '../schema';
import { settings } from '../schema';
import { migrations, runMigrations } from '../migrations';

import { createSettingsRepository } from './settings';

describe('SettingsRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let settingsRepo: ReturnType<typeof createSettingsRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		// Reset the internal singleton instance state between isolated tests
		const zeroState = createSettingsRepository({} as any);
		(zeroState.constructor as any).instance = undefined;

		// Setup isolated database pool and run schema migrations
		testSqlite = new Database(':memory:');
		testSqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		settingsRepo = createSettingsRepository(testDb);
	});

	// region get method

	describe('get()', () => {
		it('should successfully retrieve a targeted value if the key exists', () => {
			testDb
				.insert(settings)
				.values({
					key: 'executable',
					value: 'FXServer.exe',
					updatedAt: new Date(),
				})
				.run();

			const value = settingsRepo.get('executable');
			expect(value).toBe('FXServer.exe');
		});

		it('should return undefined gracefully if the key does not exist', () => {
			const value = settingsRepo.get('non_existent_key');
			expect(value).toBeUndefined();
		});
	});

	// region getmulptle

	describe('getMultiple()', () => {
		it('should resolve a mapped collection record when provided a list of keys', () => {
			testDb
				.insert(settings)
				.values([
					{ key: 'executable', value: 'FXServer', updatedAt: new Date() },
					{ key: 'onesync', value: 'on', updatedAt: new Date() },
				])
				.run();

			const results = settingsRepo.getMultiple([
				'executable',
				'onesync',
				'serverDataPath',
			] as const);

			expect(results).toEqual({
				executable: 'FXServer',
				onesync: 'on',
				serverDataPath: undefined, // Keys missing from the DB are safely mapped to undefined
			});
		});

		it('should return an empty object immediately if passed an empty keys selection array', () => {
			const results = settingsRepo.getMultiple([]);
			expect(results).toEqual({});
		});
	});

	// region set method

	describe('set() Guarded Upsert Engine', () => {
		it('should insert a new database row if an editable key is completely fresh', () => {
			const targetKey = 'fxserver.executablePath';

			const result = settingsRepo.set(targetKey, 'alpine_server');

			expect(result).toBeDefined();
			expect(result?.key).toBe(targetKey);
			expect(result?.value).toBe('alpine_server');
			expect(result?.updatedAt).toBeInstanceOf(Date);

			// Verify physical table baseline entry
			const dbCheck = testDb
				.select()
				.from(settings)
				.where(eq(settings.key, targetKey))
				.get();
			expect(dbCheck).toBeDefined();
			expect(dbCheck?.value).toBe('alpine_server');
		});

		it('should cleanly update the existing entry (upsert) when encountering conflict keys', () => {
			const targetKey = 'fxserver.serverDataPath';

			// Inject primary initial seed row
			testDb
				.insert(settings)
				.values({
					key: targetKey,
					value: '/home/fx/base',
					updatedAt: new Date('2026-01-01T00:00:00Z'),
				})
				.run();

			// Trigger structural resolution via repo mutation interface
			const updatedResult = settingsRepo.set(targetKey, '/home/fx/mutated');
			expect(updatedResult?.value).toBe('/home/fx/mutated');

			// Verify modification updates took hold inside storage
			const databaseVerificationRow = testDb
				.select()
				.from(settings)
				.where(eq(settings.key, targetKey))
				.get();
			expect(databaseVerificationRow?.value).toBe('/home/fx/mutated');
		});

		it('upserts arbitrary keys since editable-key validation now lives at the settings route rather than the repository', () => {
			const result = settingsRepo.set('whitelist.discordGuildId', '1234567890');

			expect(result?.key).toBe('whitelist.discordGuildId');
			expect(result?.value).toBe('1234567890');
		});
	});

	// region all method

	describe('all()', () => {
		it('should extract every available configuration parameter tracking inside the data table', () => {
			testDb
				.insert(settings)
				.values([
					{ key: 'executable', value: 'server', updatedAt: new Date() },
					{ key: 'onesync', value: 'off', updatedAt: new Date() },
				])
				.run();

			const generalList = settingsRepo.all();
			expect(generalList.length).toBe(2);
			expect(generalList.some((row) => row.key === 'executable')).toBe(true);
			expect(generalList.some((row) => row.key === 'onesync')).toBe(true);
		});
	});
});
