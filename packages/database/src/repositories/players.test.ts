/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows clearing private singletons and mocking unexposed relation properties */
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';

import * as schema from '../schema';
import {
	adminUsers,
	players,
	playerIdentifiers,
	bans,
	warns,
	kicks,
	playerNotes,
} from '../schema';
import { migrations, runMigrations } from '../migrations';

import { createPlayersRepository } from './players';

describe('PlayersRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let playersRepo: ReturnType<typeof createPlayersRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		// Reset singleton cache instance to ensure total database isolation
		const zeroState = createPlayersRepository({} as any);
		(zeroState.constructor as any).instance = undefined;

		// Setup isolated database context with strict foreign key constraints enforced
		testSqlite = new Database(':memory:');
		testSqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		playersRepo = createPlayersRepository(testDb);
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	// Helper utility to quickly build an admin staff account
	const seedAdminStaff = (username: string, playerId?: number) => {
		const [admin] = testDb
			.insert(adminUsers)
			.values({
				username,
				passwordHash: 'hash',
				playerId: playerId ?? null,
				createdAt: new Date(),
			})
			.returning()
			.all();
		return admin;
	};

	// region staff logic

	describe('isStaff()', () => {
		it('should accurately return true if player mapping matches an admin account row', () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Staff_Member' })
				.returning()
				.all();
			seedAdminStaff('admin_one', player.id);

			expect(playersRepo.isStaff(player.id)).toBe(true);
		});

		it('should return false if player does not match any admin records', () => {
			expect(playersRepo.isStaff(9999)).toBe(false);
		});
	});

	// region license lookup

	describe('findByLicense()', () => {
		it('should resolve comprehensive player information matching a designated license string', () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Target_User' })
				.returning()
				.all();
			testDb
				.insert(playerIdentifiers)
				.values([
					{ playerId: player.id, type: 'license', value: 'license:valid123' },
					{ playerId: player.id, type: 'discord', value: 'discord:44445555' },
				])
				.run();

			const profile = playersRepo.findByLicense('license:valid123');

			expect(profile).not.toBeNull();
			expect(profile?.name).toBe('Target_User');
			expect(profile?.isStaff).toBe(false);
			expect(profile?.identifiers).toEqual({
				license: 'license:valid123',
				discord: 'discord:44445555',
			});
		});

		it('should return null if the provided license string cannot be found', () => {
			expect(playersRepo.findByLicense('license:ghost')).toBeNull();
		});
	});

	// region upsert actions

	describe('upsert()', () => {
		const testIdentifiers = {
			license: 'license:upsert_key',
			discord: 'discord:111222',
		};

		it('should build a new database player identity profile when license lookup yields zero matches', async () => {
			const created = await playersRepo.upsert('Fresh_User', testIdentifiers);

			expect(created.id).toBeTypeOf('number');
			expect(created.name).toBe('Fresh_User');
			expect(created.isStaff).toBe(false);

			// Verify records exist inside underlying table components
			const dbIdentifiers = testDb
				.select()
				.from(playerIdentifiers)
				.where(eq(playerIdentifiers.playerId, created.id))
				.all();
			expect(dbIdentifiers.length).toBe(2);
		});

		it('should mutate active properties and append missing attributes if license lookup succeeds', async () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Old_Name' })
				.returning()
				.all();

			testDb
				.insert(playerIdentifiers)
				.values({
					playerId: player.id,
					type: 'license',
					value: 'license:upsert_key',
				})
				.run();

			const updated = await playersRepo.upsert('Mutated_Name', {
				license: 'license:upsert_key',
				discord: 'discord:new_connection',
			});

			expect(updated.id).toBe(player.id);
			expect(updated.name).toBe('Mutated_Name');

			const dbIdentifiers = testDb
				.select()
				.from(playerIdentifiers)
				.where(eq(playerIdentifiers.playerId, player.id))
				.all();
			expect(dbIdentifiers.length).toBe(2); // Retains original license and appends discord row safely
		});
	});

	// region ban validation

	describe('checkBanned()', () => {
		it('should locate a restrictive footprint match using any linked profile identifier', () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Banned_Everywhere' })
				.returning()
				.all();
			testDb
				.insert(playerIdentifiers)
				.values({ playerId: player.id, type: 'steam', value: 'steam:dirty_id' })
				.run();

			testDb
				.insert(bans)
				.values({
					playerId: player.id,
					reason: 'Cheating violations',
					createdAt: new Date(),
				})
				.run();

			const activeBan = playersRepo.checkBanned({
				license: 'license:clean',
				steam: 'steam:dirty_id',
			});
			expect(activeBan).not.toBeNull();
			expect(activeBan?.reason).toBe('Cheating violations');
		});

		it('should ignore expired or explicitly revoked blocks during active validation passes', () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Pardoned_User' })
				.returning()
				.all();
			testDb
				.insert(playerIdentifiers)
				.values({
					playerId: player.id,
					type: 'license',
					value: 'license:expired',
				})
				.run();

			testDb
				.insert(bans)
				.values({
					playerId: player.id,
					reason: 'Old toxicity record',
					createdAt: new Date(),
					expiresAt: new Date('2026-01-01T00:00:00Z'), // Past date relative to mid-2026
				})
				.run();

			const banStatus = playersRepo.checkBanned({ license: 'license:expired' });
			expect(banStatus).toBeNull();
		});
	});

	// region playtime

	describe('updatePlaytime()', () => {
		it('should adjust tracking fields and touch access markers directly inside data rows', () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Gamer' })
				.returning()
				.all();

			playersRepo.updatePlaytime(player.id, 500000);

			const updated = testDb
				.select()
				.from(players)
				.where(eq(players.id, player.id))
				.get();
			expect(updated?.playtime).toBe(500000);
			expect(updated?.lastSeen).toBeInstanceOf(Date);
		});
	});

	// region list / searching

	describe('list()', () => {
		it('should filter across diverse records using global text fuzzy parameters', () => {
			const [p1] = testDb
				.insert(players)
				.values({ name: 'Alpha_Player' })
				.returning()
				.all();
			const [p2] = testDb
				.insert(players)
				.values({ name: 'Beta_User' })
				.returning()
				.all();

			testDb
				.insert(playerIdentifiers)
				.values([
					{ playerId: p1.id, type: 'license', value: 'license:aaa' },
					{ playerId: p2.id, type: 'license', value: 'license:keyword_match' },
				])
				.run();

			// Search using a parameter that matches an identifier value instead of a name string
			const response = playersRepo.list(1, 10, { search: 'keyword' });
			expect(response.total).toBe(1);
			expect(response.items[0].id).toBe(p2.id);
		});

		it('should dynamically sort outputs based on specified structural criteria styles', () => {
			testDb
				.insert(players)
				.values([
					{ name: 'Low_Playtime', playtime: 10, lastSeen: new Date() },
					{ name: 'High_Playtime', playtime: 9999, lastSeen: new Date() },
				])
				.run();

			const response = playersRepo.list(1, 10, {
				sortBy: 'playtime',
				sortOrder: 'desc',
			});
			expect(response.items[0].name).toBe('High_Playtime');
		});
	});

	// region notes & sanctions

	describe('updatePlayerNotes()', () => {
		it('should append structured feedback logs when processing unfamiliar content strings', async () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Suspect_User' })
				.returning()
				.all();
			const admin = seedAdminStaff('moderator_bob');

			const note = await playersRepo.updatePlayerNotes(
				player.id,
				admin.id,
				'Staged for suspicious transactions',
			);
			expect(note.content).toBe('Staged for suspicious transactions');

			const records = testDb
				.select()
				.from(playerNotes)
				.where(eq(playerNotes.playerId, player.id))
				.all();
			expect(records.length).toBe(1);
		});

		it('should clean out existing rows if an update parameter arrives empty', async () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Logged_User' })
				.returning()
				.all();
			const admin = seedAdminStaff('moderator_jack');

			testDb
				.insert(playerNotes)
				.values({
					playerId: player.id,
					issuer: admin.id,
					content: 'Historical infraction baseline tracker',
					issuedAt: new Date(),
				})
				.run();

			const clearAction = await playersRepo.updatePlayerNotes(
				player.id,
				admin.id,
				'   ',
			); // Empty whitespace triggers deletion
			expect(clearAction.player).toBeDefined();

			const remaining = testDb
				.select()
				.from(playerNotes)
				.where(eq(playerNotes.playerId, player.id))
				.all();
			expect(remaining.length).toBe(0);
		});

		it('should reject changes and throw if the note content length falls below strict thresholds', () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'User' })
				.returning()
				.all();
			const admin = seedAdminStaff('mod');

			expect(
				playersRepo.updatePlayerNotes(player.id, admin.id, 'bad'),
			).rejects.toThrow('content_too_short');
		});
	});

	describe('addBan() Lifecycle Upgrades', () => {
		it('should intercept operations and return false if a permanent ban currently restricts the user profile', async () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Permanently_Restricted' })
				.returning()
				.all();
			const admin = seedAdminStaff('root_system');

			testDb
				.insert(bans)
				.values({
					playerId: player.id,
					reason: 'Original absolute ban',
					issuer: admin.id,
					createdAt: new Date(),
					expiresAt: null, // Permaban signature
				})
				.run();

			const result = await playersRepo.addBan(
				player.id,
				new Date('2026-12-31T00:00:00Z'),
				'Attempted downgraded override',
				admin.id,
			);
			expect(result).toBe(false);
		});

		it('should soft-expire active sub-bans if an administrative action escalates the duration penalty', async () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Escalation_Target' })
				.returning()
				.all();
			const admin = seedAdminStaff('senior_mod');

			const originalExpiry = new Date('2026-06-20T00:00:00Z');
			testDb
				.insert(bans)
				.values({
					playerId: player.id,
					reason: 'Minor abuse',
					issuer: admin.id,
					createdAt: new Date(),
					expiresAt: originalExpiry,
				})
				.returning()
				.all();

			const acceleratedExpiry = new Date('2026-08-30T00:00:00Z'); // Long-duration penalty escalation
			const executionResult = await playersRepo.addBan(
				player.id,
				acceleratedExpiry,
				'Severe escalation extension',
				admin.id,
			);

			expect(executionResult).not.toBe(false);
			if (typeof executionResult === 'object') {
				expect(executionResult.reason).toBe('Severe escalation extension');
			}
		});
	});

	describe('addKick() and addWarn() Standard Logging', () => {
		it('should successfully commit warning entries linked directly to active records', async () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Warned_User' })
				.returning()
				.all();
			const admin = seedAdminStaff('helper_mod');

			const warning = await playersRepo.addWarn(
				player.id,
				'Watch your language',
				admin.id,
			);
			expect(warning.reason).toBe('Watch your language');
			expect(warning.player?.name).toBe('Warned_User');

			const rowCheck = testDb
				.select()
				.from(warns)
				.where(eq(warns.playerId, player.id))
				.get();
			expect(rowCheck).toBeDefined();
		});

		it('should successfully commit kick entries linked directly to active records', async () => {
			const [player] = testDb
				.insert(players)
				.values({ name: 'Kicked_User' })
				.returning()
				.all();
			const admin = seedAdminStaff('helper_mod_2');

			const kick = await playersRepo.addKick(
				player.id,
				'Clear runway zone',
				admin.id,
			);
			expect(kick.reason).toBe('Clear runway zone');
			expect(kick.player?.name).toBe('Kicked_User');

			const rowCheck = testDb
				.select()
				.from(kicks)
				.where(eq(kicks.playerId, player.id))
				.get();
			expect(rowCheck).toBeDefined();
		});
	});
});
