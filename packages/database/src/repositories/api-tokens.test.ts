/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows clearing private singletons and verifying dates */
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';

import * as schema from '../schema';
import { apiTokens } from '../schema';
import { migrations, runMigrations } from '../migrations';

import { createApiTokensRepository } from './api-tokens';

describe('APITokensRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let tokensRepo: ReturnType<typeof createApiTokensRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		// Reset the singleton instance cache to isolate database scopes cleanly
		const zeroState = createApiTokensRepository({} as any);
		(zeroState.constructor as any).instance = undefined;

		// Provision a clean in-memory database configuration
		testSqlite = new Database(':memory:');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		tokensRepo = createApiTokensRepository(testDb);
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	describe('create()', () => {
		it('should securely generate a unique token prefixed with fp_ and write a valid database row', () => {
			const tokenName = 'External Monitoring Plugin';

			const result = tokensRepo.create(tokenName);

			expect(result).toBeDefined();
			expect(result.id).toBeTypeOf('number');
			expect(result.name).toBe(tokenName);

			expect(result.token).toStartWith('fp_');
			expect(result.token).not.toContain('-');
			expect(result.token.length).toBe(35);

			expect(result.createdAt).toBeInstanceOf(Date);
			expect(result.lastUsed).toBeNull();
			expect(result.revokedAt).toBeNull();
		});
	});

	describe('validate()', () => {
		it('should return the token row and update the lastUsed timestamp field for valid tokens', () => {
			// Seed an active token directly into the database
			const [seeded] = testDb
				.insert(apiTokens)
				.values({
					name: 'Grafana Hook',
					token: 'fp_validtokenteststring1234567890',
					createdAt: new Date(Date.now() - 5000), // Created 5s ago
				})
				.returning()
				.all();

			expect(seeded.lastUsed).toBeNull();

			// Execute validation sequence
			const validatedRow = tokensRepo.validate(seeded.token);

			expect(validatedRow).not.toBeNull();
			expect(validatedRow?.id).toBe(seeded.id);
			expect(validatedRow?.name).toBe('Grafana Hook');

			// Verify that the synchronous 'fire-and-forget' .run() operation instantly updated lastUsed field
			const dbCheck = testDb
				.select()
				.from(apiTokens)
				.where(eq(apiTokens.id, seeded.id))
				.get();
			expect(dbCheck?.lastUsed).toBeInstanceOf(Date);
		});

		it('should return null and decline verification if the target token string does not exist', () => {
			const result = tokensRepo.validate('fp_nonexistenttokenstring');
			expect(result).toBeNull();
		});

		it('should return null and reject verification if the target token has been explicitly revoked', () => {
			const [revokedToken] = testDb
				.insert(apiTokens)
				.values({
					name: 'Deprecated App',
					token: 'fp_revokedtokenteststring12345678',
					createdAt: new Date(),
					revokedAt: new Date(), // Already flagged as revoked
				})
				.returning()
				.all();

			const result = tokensRepo.validate(revokedToken.token);

			expect(result).toBeNull();
		});
	});

	describe('revoke()', () => {
		it('should stamp a revokedAt timestamp onto a token row using its identifier', () => {
			const [target] = testDb
				.insert(apiTokens)
				.values({
					name: 'Temporary Script',
					token: 'fp_temporarytokenteststring123456',
					createdAt: new Date(),
				})
				.returning()
				.all();

			const revokedRow = tokensRepo.revoke(target.id);

			expect(revokedRow).toBeDefined();
			expect(revokedRow?.revokedAt).toBeInstanceOf(Date);

			// Verify persistence directly against the transient engine block
			const dbCheck = testDb
				.select()
				.from(apiTokens)
				.where(eq(apiTokens.id, target.id))
				.get();
			expect(dbCheck?.revokedAt).not.toBeNull();
		});
	});

	describe('list()', () => {
		it('should return an array containing only non-revoked active system API tokens', () => {
			testDb
				.insert(apiTokens)
				.values([
					{
						name: 'Active Token A',
						token: 'fp_active_a_12345678901234567890',
						createdAt: new Date(),
					},
					{
						name: 'Revoked Token B',
						token: 'fp_revoked_b_12345678901234567890',
						createdAt: new Date(),
						revokedAt: new Date(), // Should exclude this row
					},
					{
						name: 'Active Token C',
						token: 'fp_active_c_12345678901234567890',
						createdAt: new Date(),
					},
				])
				.run();

			const activeList = tokensRepo.list();

			// Only 2 of the 3 seeded rows should filter through
			expect(activeList.length).toBe(2);

			const names = activeList.map((t) => t.name);
			expect(names).toContain('Active Token A');
			expect(names).toContain('Active Token C');
			expect(names).not.toContain('Revoked Token B');
		});

		it('should return an empty array smoothly if no active tokens reside in the schema catalog', () => {
			const activeList = tokensRepo.list();
			expect(activeList).toEqual([]);
		});
	});
});
