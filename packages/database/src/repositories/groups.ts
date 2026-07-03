import { asc, eq, sql } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type * as schema from '../schema';
import { adminGroups, adminUsers } from '../schema';
import { UserPermissions } from '@fxmanager/shared/constants';
import type { AdminGroupForm } from '@fxmanager/shared/types';

type DB = BunSQLiteDatabase<typeof schema>;

class GroupsRepository {
	private static instance: GroupsRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): GroupsRepository {
		if (!GroupsRepository.instance) {
			GroupsRepository.instance = new GroupsRepository(db);
		}

		return GroupsRepository.instance;
	}

	list() {
		return this.db
			.select({
				id: adminGroups.id,
				name: adminGroups.name,
				permissions: adminGroups.permissions,
				colour: adminGroups.colour,
				icon: adminGroups.icon,
				createdAt: adminGroups.createdAt,
				memberCount: sql<number>`count(${adminUsers.id})`,
			})
			.from(adminGroups)
			.leftJoin(adminUsers, eq(adminUsers.groupId, adminGroups.id))
			.groupBy(adminGroups.id)
			.orderBy(asc(adminGroups.name))
			.all();
	}

	get(groupId: number) {
		return (
			this.db
				.select()
				.from(adminGroups)
				.where(eq(adminGroups.id, groupId))
				.get() ?? null
		);
	}

	create(form: AdminGroupForm) {
		return this.db
			.insert(adminGroups)
			.values({
				name: form.name,
				permissions: form.permissions & ~UserPermissions.MASTER,
				colour: form.colour,
				icon: form.icon ?? null,
				createdAt: new Date(),
			})
			.returning()
			.get();
	}

	update(groupId: number, patch: Partial<AdminGroupForm>) {
		const updated = this.db
			.update(adminGroups)
			.set({
				...(patch.name !== undefined && { name: patch.name }),
				...(patch.permissions !== undefined && {
					permissions: patch.permissions & ~UserPermissions.MASTER,
				}),
				...(patch.colour !== undefined && { colour: patch.colour }),
				...(patch.icon !== undefined && { icon: patch.icon }),
			})
			.where(eq(adminGroups.id, groupId))
			.returning()
			.get();

		if (!updated) throw new Error('not_found');

		return updated;
	}

	delete(groupId: number) {
		const members = this.db
			.select({ count: sql<number>`count(*)` })
			.from(adminUsers)
			.where(eq(adminUsers.groupId, groupId))
			.get();

		if ((members?.count ?? 0) > 0) throw new Error('group_in_use');

		const deleted = this.db
			.delete(adminGroups)
			.where(eq(adminGroups.id, groupId))
			.returning()
			.get();

		if (!deleted) throw new Error('not_found');

		return deleted;
	}
}

export function createGroupsRepository(db: DB) {
	return GroupsRepository.getInstance(db);
}
