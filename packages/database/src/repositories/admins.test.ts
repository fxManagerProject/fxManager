/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows testing hidden state properties & mocking frames */
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import { adminUsers } from '../schema';
import { migrations, runMigrations } from '../migrations';
import { createAdminsRepository } from './admins';
import { UserPermissions } from '@fxmanager/shared/constants';

describe('AdminsRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let adminsRepo: ReturnType<typeof createAdminsRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		// This allows you to reset the cache without changing your production code
		const zeroState = createAdminsRepository({} as any);
		(zeroState.constructor as any).instance = undefined;

		testSqlite = new Database(':memory:');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		adminsRepo = createAdminsRepository(testDb);
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	describe('list()', () => {
		it('should return a paginated layout of administrators sorted by creation date descending', () => {
			testDb
				.insert(adminUsers)
				.values([
					{
						username: 'moderator_one',
						passwordHash: 'hash1',
						permissions: UserPermissions.KICK | UserPermissions.WARN,
						createdAt: new Date('2026-01-01'),
					},
					{
						username: 'admin_two',
						passwordHash: 'hash2',
						permissions: UserPermissions.BAN,
						createdAt: new Date('2026-06-01'),
					},
				])
				.run();

			const result = adminsRepo.list(1, 20);

			expect(result.total).toBe(2);
			expect(result.page).toBe(1);
			expect(result.pageSize).toBe(20);
			expect(result.items[0].username).toBe('admin_two');
			expect(result.items[1].username).toBe('moderator_one');
			expect(result.items[0].group).toBeDefined();
		});

		it('should filter items accurately when a search query parameter is provided', () => {
			testDb
				.insert(adminUsers)
				.values([
					{ username: 'super_admin', passwordHash: 'h', createdAt: new Date() },
					{ username: 'regular_mod', passwordHash: 'h', createdAt: new Date() },
				])
				.run();

			const result = adminsRepo.list(1, 10, { search: 'super' });

			expect(result.total).toBe(1);
			expect(result.items[0].username).toBe('super_admin');
		});
	});

	describe('updatePermissions()', () => {
		it('should successfully update and sanitize permissions for standard accounts', async () => {
			const [inserted] = testDb
				.insert(adminUsers)
				.values({
					username: 'staff_member',
					passwordHash: 'secure_hash',
					permissions: UserPermissions.KICK,
					createdAt: new Date(),
				})
				.returning()
				.all();

			const targetPerms = UserPermissions.KICK | UserPermissions.BAN;

			const updateResult = await adminsRepo.updatePermissions(
				inserted.id,
				targetPerms,
			);

			expect(updateResult.oldPermissions).toBe(UserPermissions.KICK);
			expect(updateResult.newPermissions).toBe(targetPerms);

			// FIX 2: Using the direct 'eq' import here instead of 'schema.eq'
			const updatedUser = testDb
				.select()
				.from(adminUsers)
				.where(eq(adminUsers.id, inserted.id))
				.get();
			expect(updatedUser?.permissions).toBe(targetPerms);
		});

		it('should enforce a failsafe preventing the acquisition of MASTER privileges', async () => {
			const [inserted] = testDb
				.insert(adminUsers)
				.values({
					username: 'sneaky_mod',
					passwordHash: 'h',
					permissions: UserPermissions.NONE,
					createdAt: new Date(),
				})
				.returning()
				.all();

			const maliciousPerms = UserPermissions.KICK | UserPermissions.MASTER;

			const result = await adminsRepo.updatePermissions(
				inserted.id,
				maliciousPerms,
			);

			expect(result.newPermissions).toBe(UserPermissions.KICK);
			expect(result.newPermissions & UserPermissions.MASTER).toBe(0);
		});

		it('should throw an error and halt execution if attempting to modify a MASTER account', async () => {
			const [masterAdmin] = testDb
				.insert(adminUsers)
				.values({
					username: 'root_owner',
					passwordHash: 'h',
					permissions: UserPermissions.MASTER,
					createdAt: new Date(),
				})
				.returning()
				.all();

			expect(
				adminsRepo.updatePermissions(masterAdmin.id, UserPermissions.NONE),
			).rejects.toThrow('admin_is_master');
		});

		it('should throw an error if the requested adminId is not found', async () => {
			expect(
				adminsRepo.updatePermissions(9999, UserPermissions.BAN),
			).rejects.toThrow('not_found');
		});
	});

	describe('getProfile()', () => {
    it('should return null if the requested adminId does not exist inside storage', async () => {
      const result = await adminsRepo.getProfile(99999);
      expect(result).toBeNull();
    });

    it('should compile profile configurations without audit logging maps when showAudit parameter is omitted', async () => {
      const [player] = testDb.insert(schema.players).values({ name: 'Linked_User_Name' }).returning().all();
      const [admin] = testDb
        .insert(adminUsers)
        .values({
          username: 'profile_tester',
          passwordHash: 'hidden_hash',
          permissions: UserPermissions.BAN,
          playerId: player.id,
          createdAt: new Date(),
        })
        .returning()
        .all();

      const profile = await adminsRepo.getProfile(admin.id);

      expect(profile).not.toBeNull();
      expect(profile?.username).toBe('profile_tester');
      expect(profile?.playerName).toBe('Linked_User_Name');
      expect((profile as any).passwordHash).toBeUndefined(); // Confirms explicit column exclusion list bounds
      expect(profile?.auditLogs).toEqual([]); // Empty because showAudit defaulted to false
    });

    it('should pull, merge, and append resolving lookup entities into log matrix records when showAudit is high', async () => {
      // Prepare relational assets
      const [targetPlayer] = testDb.insert(schema.players).values({ name: 'Gamer_Tag_One' }).returning().all();
      const [admin] = testDb
        .insert(adminUsers)
        .values({
          username: 'audited_admin',
          passwordHash: 'hash',
          permissions: UserPermissions.KICK,
          createdAt: new Date(),
        })
        .returning()
        .all();

      // Inject raw sequential operational audit metrics targeting different player profiles
      testDb
        .insert(schema.auditLog)
        .values([
          {
            adminId: admin.id,
            action: 'KICK_PLAYER',
            playerId: targetPlayer.id,
            createdAt: new Date('2026-06-14T12:00:00Z'),
          },
          {
            adminId: admin.id,
            action: 'WARN_PLAYER',
            playerId: 9999, // Unresolvable Player ID simulation (deleted/missing)
            createdAt: new Date('2026-06-14T10:00:00Z'),
          },
        ])
        .run();

      const profile = await adminsRepo.getProfile(admin.id, true); // showAudit = true

      expect(profile?.auditLogs).toHaveLength(2);
      
      // First audit entry (Most recent: KICK_PLAYER)
      expect(profile?.auditLogs[0].action).toBe('KICK_PLAYER');
      expect(profile?.auditLogs[0].admin).toBe('audited_admin');
      expect(profile?.auditLogs[0].player).toBe('Gamer_Tag_One'); // Successfully resolved join lookup

      // Second audit entry (Older execution: WARN_PLAYER)
      expect(profile?.auditLogs[1].action).toBe('WARN_PLAYER');
      expect(profile?.auditLogs[1].player).toBeNull(); // Graceful fallback on missing relational records
    });
  });

	describe('updateLinkedPlayer()', () => {
    it('should successfully update the linked playerId for a standard administrator account', async () => {
      // Seed a baseline player and admin
      const [player] = testDb.insert(schema.players).values({ name: 'Alpha_Player' }).returning().all();
      const [admin] = testDb
        .insert(adminUsers)
        .values({
          username: 'standard_mod',
          passwordHash: 'hash',
          permissions: UserPermissions.KICK,
          playerId: null,
          createdAt: new Date(),
        })
        .returning()
        .all();

      const result = await adminsRepo.updateLinkedPlayer(admin.id, player.id, false);

      expect(result.previousPlayerId).toBeNull();
      expect(result.newPlayerId).toBe(player.id);
      expect(result.playerId).toBe(player.id);

      // Double check internal DB persistent state
      const updatedAdmin = testDb.select().from(adminUsers).where(eq(adminUsers.id, admin.id)).get();
      expect(updatedAdmin?.playerId).toBe(player.id);
    });

    it('should throw an error if the targeted admin record cannot be found', async () => {
      expect(
        adminsRepo.updateLinkedPlayer(99999, 1, false)
      ).rejects.toThrow('not_found');
    });

    it('should block modification and throw an error if a MASTER admin is handled without the isMaster flag override', async () => {
      const [masterAdmin] = testDb
        .insert(adminUsers)
        .values({
          username: 'owner_account',
          passwordHash: 'hash',
          permissions: UserPermissions.MASTER,
          createdAt: new Date(),
        })
        .returning()
        .all();

      expect(
        adminsRepo.updateLinkedPlayer(masterAdmin.id, 5, false) // isMaster = false
      ).rejects.toThrow('admin_is_master');
    });

    it('should bypass the master lock restriction and update successfully if isMaster flag is explicitly true', async () => {
      const [player] = testDb.insert(schema.players).values({ name: 'Owner_InGame' }).returning().all();
      const [masterAdmin] = testDb
        .insert(adminUsers)
        .values({
          username: 'owner_account_two',
          passwordHash: 'hash',
          permissions: UserPermissions.MASTER,
          createdAt: new Date(),
        })
        .returning()
        .all();

      const result = await adminsRepo.updateLinkedPlayer(masterAdmin.id, player.id, true); // isMaster = true
      expect(result.newPlayerId).toBe(player.id);
    });
  });
});
