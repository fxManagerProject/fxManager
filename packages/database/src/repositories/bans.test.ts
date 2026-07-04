/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows clearing private singletons and handling unmapped repository signatures */
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';

import * as schema from '../schema';
import { bans, players, playerIdentifiers } from '../schema';
import { migrations, runMigrations } from '../migrations';

import { createBansRepository } from './bans';

describe('BansRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let bansRepo: ReturnType<typeof createBansRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		// Reset singleton cache instance to ensure total database isolation
		const zeroState = createBansRepository({} as any);
		(zeroState.constructor as any).instance = undefined;

		// Setup database context with strict foreign key constraints enabled
		testSqlite = new Database(':memory:');
		testSqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		bansRepo = createBansRepository(testDb);
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	// Helper utility to seed standard player relational parents
	const seedPlayerWithLicense = (name: string, licenseValue: string) => {
		const [player] = testDb.insert(players).values({ name }).returning().all();

		testDb
			.insert(playerIdentifiers)
			.values({
				playerId: player.id,
				type: 'license',
				value: licenseValue,
			})
			.run();

		return player;
	};

	describe('create()', () => {
		it('should successfully append a new ban tracking row connected to a target player', () => {
			const player = seedPlayerWithLicense('Cheater_One', 'license:abcd1234');

			const banResult = bansRepo.create({
				playerId: player.id,
				reason: 'Cheating / Exploiting',
				bannedBy: 'Admin_Staff', // Passed directly to fulfill the repo method signature
			});

			expect(banResult).toBeDefined();
			expect(banResult.id).toBeTypeOf('number');
			expect(banResult.playerId).toBe(player.id);
			expect(banResult.reason).toBe('Cheating / Exploiting');
			expect(banResult.createdAt).toBeInstanceOf(Date);
			expect(banResult.expiresAt).toBeNull();
			expect(banResult.revokedAt).toBeNull();
		});
	});

	describe('revoke()', () => {
		it('should flag an active ban as resolved by writing a timestamp into the revokedAt column', () => {
			const player = seedPlayerWithLicense(
				'Reformed_Gamer',
				'license:clean999',
			);
			const [initialBan] = testDb
				.insert(bans)
				.values({
					playerId: player.id,
					reason: 'Toxic Behavior',
					createdAt: new Date(),
				})
				.returning()
				.all();

			const revokedBan = bansRepo.revoke(initialBan.id);

			expect(revokedBan).toBeDefined();
			expect(revokedBan?.revokedAt).toBeInstanceOf(Date);

			// Verify immediate database persistence
			const dbCheck = testDb
				.select()
				.from(bans)
				.where(eq(bans.id, initialBan.id))
				.get();
			expect(dbCheck?.revokedAt).toBeInstanceOf(Date);
		});

		it('should return undefined when the ban is already revoked', () => {
			const player = seedPlayerWithLicense('Repeat_Appeal', 'license:appeal1');
			const [initialBan] = testDb
				.insert(bans)
				.values({
					playerId: player.id,
					reason: 'Toxic Behavior',
					createdAt: new Date(),
				})
				.returning()
				.all();

			bansRepo.revoke(initialBan.id);

			expect(bansRepo.revoke(initialBan.id)).toBeUndefined();
		});

		it('should return undefined for a non-existent ban', () => {
			expect(bansRepo.revoke(9999)).toBeUndefined();
		});

		it('should not revoke when the scoped playerId does not own the ban', () => {
			const owner = seedPlayerWithLicense('Owner', 'license:owner1');
			const other = seedPlayerWithLicense('Other', 'license:other1');
			const [ban] = testDb
				.insert(bans)
				.values({
					playerId: owner.id,
					reason: 'Toxic Behavior',
					createdAt: new Date(),
				})
				.returning()
				.all();

			expect(bansRepo.revoke(ban.id, other.id)).toBeUndefined();

			const dbCheck = testDb
				.select()
				.from(bans)
				.where(eq(bans.id, ban.id))
				.get();
			expect(dbCheck?.revokedAt).toBeNull();
		});
	});

	describe('isLicenseBanned() Conditional Verification', () => {
		const targetLicense = 'license:malicious_footprint_123';

		it('should confirm active status (return true) if a permanent ban holds no expiry timestamp', () => {
			const player = seedPlayerWithLicense('Banned_User_A', targetLicense);
			testDb
				.insert(bans)
				.values({
					playerId: player.id,
					reason: 'Permaban',
					createdAt: new Date(),
				})
				.run();

			const isBanned = bansRepo.isLicenseBanned(targetLicense);
			expect(isBanned).toBe(true);
		});

		it('should confirm active status (return true) if a temporary ban expiration resides in the future', () => {
			const player = seedPlayerWithLicense('Banned_User_B', targetLicense);
			testDb
				.insert(bans)
				.values({
					playerId: player.id,
					reason: 'Temp ban',
					createdAt: new Date(),
					expiresAt: new Date('2026-12-31T23:59:59Z'), // Future date relative to mid-2026
				})
				.run();

			const isBanned = bansRepo.isLicenseBanned(targetLicense);
			expect(isBanned).toBe(true);
		});

		it('should clear status (return false) if a temporary ban expiration resides in the past', () => {
			const player = seedPlayerWithLicense('Banned_User_C', targetLicense);
			testDb
				.insert(bans)
				.values({
					playerId: player.id,
					reason: 'Expired ban',
					createdAt: new Date('2026-01-01T00:00:00Z'),
					expiresAt: new Date('2026-05-01T00:00:00Z'), // Past date relative to mid-2026
				})
				.run();

			const isBanned = bansRepo.isLicenseBanned(targetLicense);
			expect(isBanned).toBe(false);
		});

		it('should clear status (return false) if a valid matching ban row has been revoked', () => {
			const player = seedPlayerWithLicense('Banned_User_D', targetLicense);
			testDb
				.insert(bans)
				.values({
					playerId: player.id,
					reason: 'Appealed ban',
					createdAt: new Date(),
					revokedAt: new Date(), // Flagged as resolved
				})
				.run();

			const isBanned = bansRepo.isLicenseBanned(targetLicense);
			expect(isBanned).toBe(false);
		});

		it('should evaluate to false if the target license sequence does not exist inside identifier logs', () => {
			const isBanned = bansRepo.isLicenseBanned(
				'license:completely_unknown_value',
			);
			expect(isBanned).toBe(false);
		});
	});

	describe('list()', () => {
		it('should return combined relational result rows structured inside flat join layouts matching Drizzle defaults', () => {
			const playerA = seedPlayerWithLicense('User_A', 'license:aaa');
			const playerB = seedPlayerWithLicense('User_B', 'license:bbb');

			testDb
				.insert(bans)
				.values([
					{
						playerId: playerA.id,
						reason: 'Rule 1',
						createdAt: new Date('2026-06-14T08:00:00Z'),
					},
					{
						playerId: playerB.id,
						reason: 'Rule 2',
						createdAt: new Date('2026-06-14T09:00:00Z'),
					},
				])
				.run();

			// Execute pagination lookup (Page 1, size 10)
			const executionList = bansRepo.list(1, 10);

			expect(executionList.length).toBe(2);

			// Verify Drizzle-ORM default nested mapping behavior for unselected multi-table queries
			// Shape must match: Array<{ bans: typeof bans.$inferSelect, players: typeof players.$inferSelect }>
			expect(executionList[0].bans).toBeDefined();
			expect(executionList[0].players).toBeDefined();

			expect(executionList[0].players.name).toBe('User_A');
			expect(executionList[0].bans.reason).toBe('Rule 1');

			expect(executionList[1].players.name).toBe('User_B');
		});

		it('should calculate layout limits and offsets accurately during pagination calls', () => {
			const player = seedPlayerWithLicense('User_C', 'license:ccc');

			testDb
				.insert(bans)
				.values([
					{
						playerId: player.id,
						reason: 'Ban 1',
						createdAt: new Date('2026-06-14T01:00:00Z'),
					},
					{
						playerId: player.id,
						reason: 'Ban 2',
						createdAt: new Date('2026-06-14T02:00:00Z'),
					},
					{
						playerId: player.id,
						reason: 'Ban 3',
						createdAt: new Date('2026-06-14T03:00:00Z'),
					},
				])
				.run();

			// Ask for Page 2 with a PageSize of 1 (should skip Ban 1, return Ban 2)
			const pageResult = bansRepo.list(2, 1);

			expect(pageResult.length).toBe(1);
			expect(pageResult[0].bans.reason).toBe('Ban 2');
		});
	});

	describe('search()', () => {
		it('should return flat rows newest-first when no query is given', () => {
			const alice = seedPlayerWithLicense('Alice', 'license:aaa');
			const bob = seedPlayerWithLicense('Bob', 'license:bbb');

			testDb
				.insert(bans)
				.values([
					{
						playerId: alice.id,
						reason: 'first',
						createdAt: new Date('2026-06-14T08:00:00Z'),
					},
					{
						playerId: bob.id,
						reason: 'second',
						createdAt: new Date('2026-06-14T09:00:00Z'),
					},
				])
				.run();

			const result = bansRepo.search();

			expect(result.length).toBe(2);
			// newest first
			expect(result[0].reason).toBe('second');
			expect(result[0].name).toBe('Bob');
			expect(result[1].reason).toBe('first');
			// flat shape
			expect(result[0]).toMatchObject({
				id: expect.any(Number),
				playerId: bob.id,
				name: 'Bob',
				reason: 'second',
				issuer: null,
				revokedAt: null,
			});
			expect(result[0].createdAt).toBeInstanceOf(Date);
		});

		it('should filter by player name', () => {
			const alice = seedPlayerWithLicense('Alice', 'license:aaa');
			const bob = seedPlayerWithLicense('Bob', 'license:bbb');
			testDb
				.insert(bans)
				.values([
					{ playerId: alice.id, reason: 'r1', createdAt: new Date() },
					{ playerId: bob.id, reason: 'r2', createdAt: new Date() },
				])
				.run();

			const result = bansRepo.search({ query: 'Ali' });

			expect(result.length).toBe(1);
			expect(result[0].name).toBe('Alice');
		});

		it('should filter by identifier value without duplicating rows for multi-identifier players', () => {
			const charlie = seedPlayerWithLicense('Charlie', 'license:ccc');
			testDb
				.insert(playerIdentifiers)
				.values({ playerId: charlie.id, type: 'discord', value: 'discord:999' })
				.run();
			testDb
				.insert(bans)
				.values({
					playerId: charlie.id,
					reason: 'exploiting',
					createdAt: new Date(),
				})
				.run();

			const byLicense = bansRepo.search({ query: 'ccc' });
			expect(byLicense.length).toBe(1);
			expect(byLicense[0].name).toBe('Charlie');

			const byName = bansRepo.search({ query: 'Charlie' });
			expect(byName.length).toBe(1);
		});

		it('should filter by ban reason', () => {
			const dave = seedPlayerWithLicense('Dave', 'license:ddd');
			testDb
				.insert(bans)
				.values([
					{
						playerId: dave.id,
						reason: 'aimbot detected',
						createdAt: new Date(),
					},
					{ playerId: dave.id, reason: 'toxicity', createdAt: new Date() },
				])
				.run();

			const result = bansRepo.search({ query: 'aimbot' });

			expect(result.length).toBe(1);
			expect(result[0].reason).toBe('aimbot detected');
		});
	});
});
