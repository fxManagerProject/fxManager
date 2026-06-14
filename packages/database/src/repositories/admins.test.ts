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
});
