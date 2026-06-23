/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows clearing private singletons and handling dynamic relational values */
import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';

import * as schema from '../schema';
import {
	whitelistedIdentifers,
	adminUsers,
	players,
	playerIdentifiers,
} from '../schema';
import { migrations, runMigrations } from '../migrations';

import { createWhitelistRepository } from './whitelist';

describe('WhitelistRepository Integration Tests', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let whitelistRepo: ReturnType<typeof createWhitelistRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		// Reset singleton cache instance to ensure total database isolation
		const zeroState = createWhitelistRepository({} as any);
		(zeroState.constructor as any).instance = undefined;

		// Setup database context with strict foreign key constraints enabled
		testSqlite = new Database(':memory:');
		testSqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		whitelistRepo = createWhitelistRepository(testDb);
	});

	// region identifier checks

	describe('isAnyIdentifierWhitelisted()', () => {
		it('should return true if at least one secondary tracking profile identifier matches', async () => {
			testDb
				.insert(whitelistedIdentifers)
				.values({
					type: 'discord',
					value: 'discord:11112222',
					addedAt: new Date(),
				})
				.run();

			const checkingSet = {
				license: 'license:unrelated_fresh_license',
				discord: 'discord:11112222', // This matches the whitelisted record
			};

			const result =
				await whitelistRepo.isAnyIdentifierWhitelisted(checkingSet);
			expect(result).toBe(true);
		});

		it('should evaluate to false if none of the incoming identifiers find a match', async () => {
			const result = await whitelistRepo.isAnyIdentifierWhitelisted({
				license: 'license:clean_and_unknown',
			});
			expect(result).toBe(false);
		});
	});

	// region add method

	describe('add() Format Gating & Conflicts', () => {
		it('should successfully pass validation and record a well-formed license sequence', () => {
			const success = whitelistRepo.add({
				type: 'license',
				value: 'license:abcdef1234567890',
			});

			expect(success).toBe(true);

			const saved = testDb.select().from(whitelistedIdentifers).get();
			expect(saved?.type).toBe('license');
			expect(saved?.system).toBe(0);
		});

		it('should accept custom configurations flag combinations and explicitly map system entries', () => {
			whitelistRepo.add({
				type: 'discord',
				value: 'discord:5555555',
				system: true,
			});

			const saved = testDb.select().from(whitelistedIdentifers).get();
			expect(saved?.system).toBe(1);
		});

		it('should reject structurally broken identifiers and throw format exceptions', () => {
			expect(() => {
				whitelistRepo.add({
					type: 'discord',
					value: 'broken_prefix_without_id',
				});
			}).toThrow('invalid_format');

			expect(() => {
				whitelistRepo.add({
					type: 'license',
					value: 'license:UPPERCASE_AND_INVALID_CHARS_Z',
				});
			}).toThrow('invalid_format');
		});

		it('should throw an exception if the designated platform target type is unsupported', () => {
			expect(() => {
				whitelistRepo.add({ type: 'xboxlive', value: 'xbox:123' });
			}).toThrow('unsupported_type');
		});

		it('should capture index conflicts and abort with explicit duplication warnings', () => {
			whitelistRepo.add({ type: 'fivem', value: 'fivem:99999' });

			// Re-adding the exact same value should trigger the .onConflictDoNothing() -> throw lifecycle
			expect(() => {
				whitelistRepo.add({ type: 'fivem', value: 'fivem:99999' });
			}).toThrow('already_whitelisted');
		});
	});

	// region listing

	describe('list() Complex Left Joins', () => {
		it('should calculate structural string fallbacks if records lack relational links', async () => {
			// Direct insertion bypassing mapping associations
			testDb
				.insert(whitelistedIdentifers)
				.values({
					type: 'steam',
					value: 'steam:11000011ab',
					addedAt: new Date(),
					system: 0,
				})
				.run();

			const response = await whitelistRepo.list(1, 10);
			expect(response.items.length).toBe(1);

			// Asserts business logic transformations are executed accurately
			expect(response.items[0].addedByAdmin).toBe('deleted_admin');
			expect(response.items[0].playerName).toBe('N/A');
		});

		it('should correctly prioritize and map the system indicator string when flags are high', async () => {
			testDb
				.insert(whitelistedIdentifers)
				.values({
					type: 'license',
					value: 'license:9999aaaa',
					addedAt: new Date(),
					system: 1, // System flag set to high
				})
				.run();

			const response = await whitelistRepo.list(1, 10);
			expect(response.items[0].addedByAdmin).toBe('system');
		});

		it('should execute deep multi-table text filtering when passing down search strings', async () => {
			// Setup a cascading chain: Admin profile + Player + Player Identifier -> Whitelist Link
			const [admin] = testDb
				.insert(adminUsers)
				.values({
					username: 'Staff_Alpha',
					passwordHash: 'secret',
					createdAt: new Date(),
				})
				.returning()
				.all();

			const [player] = testDb
				.insert(players)
				.values({ name: 'Charlie_Properties' })
				.returning()
				.all();
			testDb
				.insert(playerIdentifiers)
				.values({
					playerId: player.id,
					type: 'license',
					value: 'license:find_me_match',
				})
				.run();

			testDb
				.insert(whitelistedIdentifers)
				.values({
					type: 'license',
					value: 'license:find_me_match',
					adminId: admin.id,
					addedAt: new Date(),
				})
				.run();

			// Execute search on player name substring
			const searchByName = await whitelistRepo.list(1, 10, {
				search: 'Charlie',
			});
			expect(searchByName.total).toBe(1);
			expect(searchByName.items[0].playerName).toBe('Charlie_Properties');
			expect(searchByName.items[0].addedByAdmin).toBe('Staff_Alpha');

			// Execute search on administrative username substring
			const searchByAdmin = await whitelistRepo.list(1, 10, {
				search: 'Alpha',
			});
			expect(searchByAdmin.total).toBe(1);
		});
	});

	// region revocation

	describe('revoke()', () => {
		it('should delete a whitelist record completely and return the removed element details', () => {
			const [inserted] = testDb
				.insert(whitelistedIdentifers)
				.values({
					type: 'fivem',
					value: 'fivem:777888',
					addedAt: new Date(),
				})
				.returning()
				.all();

			const revoked = whitelistRepo.revoke(inserted.id);
			expect(revoked).toBeDefined();
			expect(revoked?.id).toBe(inserted.id);

			// Confirm row removal from database storage
			const check = testDb
				.select()
				.from(whitelistedIdentifers)
				.where(eq(whitelistedIdentifers.id, inserted.id))
				.get();
			expect(check).toBeUndefined();
		});
	});
});
