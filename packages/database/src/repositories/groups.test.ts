/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows resetting singleton state */
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../schema';
import { adminGroups, adminUsers } from '../schema';
import { migrations, runMigrations } from '../migrations';
import { createGroupsRepository } from './groups';
import { UserPermissions } from '@fxmanager/shared/constants';

describe('GroupsRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let groupsRepo: ReturnType<typeof createGroupsRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		const zeroState = createGroupsRepository({} as any);
		(zeroState.constructor as any).instance = undefined;

		testSqlite = new Database(':memory:');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		groupsRepo = createGroupsRepository(testDb);

		// migration 0006 seeds preset groups; start empty for deterministic tests
		testDb.delete(adminGroups).run();
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	const insertGroup = (name: string, permissions = 0) =>
		testDb
			.insert(adminGroups)
			.values({ name, permissions, colour: '#ffffff', createdAt: new Date() })
			.returning()
			.get();

	const insertAdmin = (username: string, groupId: number | null = null) =>
		testDb
			.insert(adminUsers)
			.values({
				username,
				passwordHash: 'hash',
				permissions: 0,
				groupId,
				createdAt: new Date(),
			})
			.returning()
			.get();

	describe('list()', () => {
		it('should return all groups with their member counts', () => {
			const moderation = insertGroup('Moderation', UserPermissions.KICK);
			insertGroup('Development');
			insertAdmin('mod_one', moderation.id);
			insertAdmin('mod_two', moderation.id);
			insertAdmin('loner');

			const result = groupsRepo.list();

			expect(result).toHaveLength(2);
			const byName = new Map(result.map((g) => [g.name, g]));
			expect(byName.get('Moderation')?.memberCount).toBe(2);
			expect(byName.get('Moderation')?.permissions).toBe(UserPermissions.KICK);
			expect(byName.get('Development')?.memberCount).toBe(0);
		});
	});

	describe('create()', () => {
		it('should persist a group and strip the MASTER bit', () => {
			const created = groupsRepo.create({
				name: 'Staff',
				permissions: UserPermissions.KICK | UserPermissions.MASTER,
				colour: '#123456',
				icon: 'Shield',
			});

			expect(created.name).toBe('Staff');
			expect(created.permissions).toBe(UserPermissions.KICK);
			expect(created.colour).toBe('#123456');
			expect(created.icon).toBe('Shield');
			expect(groupsRepo.get(created.id)?.name).toBe('Staff');
		});

		it('should reject duplicate group names', () => {
			groupsRepo.create({ name: 'Staff', permissions: 0, colour: '#fff' });

			expect(() =>
				groupsRepo.create({ name: 'Staff', permissions: 0, colour: '#fff' }),
			).toThrow(/UNIQUE/);
		});
	});

	describe('update()', () => {
		it('should patch fields and strip the MASTER bit', () => {
			const group = insertGroup('Staff', UserPermissions.KICK);

			const updated = groupsRepo.update(group.id, {
				name: 'Senior Staff',
				permissions: UserPermissions.BAN | UserPermissions.MASTER,
			});

			expect(updated.name).toBe('Senior Staff');
			expect(updated.permissions).toBe(UserPermissions.BAN);
			expect(updated.colour).toBe('#ffffff');
		});

		it('should throw not_found for a missing group', () => {
			expect(() => groupsRepo.update(999, { name: 'Ghost' })).toThrow(
				'not_found',
			);
		});
	});

	describe('delete()', () => {
		it('should delete an empty group', () => {
			const group = insertGroup('Staff');

			groupsRepo.delete(group.id);

			expect(groupsRepo.get(group.id)).toBeNull();
		});

		it('should refuse to delete a group with members', () => {
			const group = insertGroup('Staff');
			insertAdmin('member', group.id);

			expect(() => groupsRepo.delete(group.id)).toThrow('group_in_use');
			expect(groupsRepo.get(group.id)).not.toBeNull();
		});

		it('should throw not_found for a missing group', () => {
			expect(() => groupsRepo.delete(999)).toThrow('not_found');
		});
	});
});
