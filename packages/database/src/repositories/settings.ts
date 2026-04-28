import { asc, desc, eq, like, sql } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { settings, adminUsers, auditLog } from '../schema';
import type * as schema from '../schema';
import type { BaseAdminUser, PaginatedResponse } from '@fxmanager/shared/types';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';
import type { AdminProfile } from '../types';

type DB = BunSQLiteDatabase<typeof schema>;

export function createSettingsRepository(db: DB) {
	return {
		get<T = unknown>(key: string): T | undefined {
			const row = db.select().from(settings).where(eq(settings.key, key)).get();
			return row?.value as T | undefined;
		},

		set(key: string, value: unknown) {
			return db
				.insert(settings)
				.values({ key, value, updatedAt: new Date() })
				.onConflictDoUpdate({
					target: settings.key,
					set: { value, updatedAt: new Date() },
				})
				.returning()
				.get();
		},

		all() {
			return db.select().from(settings).all();
		},

		listAdmins(
			page = 1,
			pageSize = 20,
			options?: {
				search?: string;
				sortBy?: 'createdAt' | 'lastLoginAt';
				sortOrder?: 'asc' | 'desc';
			},
		): PaginatedResponse<BaseAdminUser> {
			const {
				search,
				sortBy = 'createdAt',
				sortOrder = 'desc',
			} = options ?? {};

			const sortCol = {
				createdAt: adminUsers.createdAt,
				lastLoginAt: adminUsers.lastLoginAt,
			}[sortBy];

			const orderFn = sortOrder === 'asc' ? asc : desc;

			const filters = search
				? like(adminUsers.username, `%${search}%`)
				: undefined;

			const countQuery = db
				.select({ count: sql<number>`count(distinct ${adminUsers.id})` })
				.from(adminUsers)
				.where(filters);

			const totalResult = countQuery.get();
			const total = totalResult?.count ?? 0;

			const query = db
				.select({
					id: adminUsers.id,
					username: adminUsers.username,
					permissions: adminUsers.permissions,
					playerId: adminUsers.playerId,
					createdAt: adminUsers.createdAt,
					lastLoginAt: adminUsers.lastLoginAt,
				})
				.from(adminUsers)
				.where(filters)
				.$dynamic();

			const response = query
				.orderBy(orderFn(sortCol))
				.limit(pageSize)
				.offset((page - 1) * pageSize)
				.all();

			return {
				items: response.map((admin) => ({
					...admin,
					group: PermissionManager.getGroup(admin.permissions),
				})),
				total,
				page,
				pageSize,
			};
		},

		async getAdminProfile(adminId: number): Promise<AdminProfile | null> {
			const profile = await db.query.adminUsers.findFirst({
				where: eq(adminUsers.id, adminId),
				columns: {
					id: true,
					username: true,
					permissions: true,
					playerId: true,
					createdAt: true,
					lastLoginAt: true,
				},
				with: {
					auditLogs: {
						limit: 10,
						orderBy: [desc(auditLog.createdAt)],
					},
				},
			});

			if (!profile) return null;

			return {
				...profile,
				group: PermissionManager.getGroup(profile.permissions),
			};
		},

		async updateAdminPermissions(adminId: number, newPerms: number) {
			const admin = await db.query.adminUsers.findFirst({
				where: eq(adminUsers.id, adminId),
				columns: { permissions: true },
			});

			if (!admin) throw new Error('not_found');
			if (admin.permissions & UserPermissions.MASTER)
				throw new Error('admin_is_master');

			// failsafe final check, don't set master permission
			const sanitizedPerms = newPerms & ~UserPermissions.MASTER;

			const result = await db
				.update(adminUsers)
				.set({
					permissions: sanitizedPerms,
				})
				.where(eq(adminUsers.id, adminId))
				.returning({ newPerms: adminUsers.permissions });

			if (!result[0]) throw new Error('not_found');

			return result[0];
		},

		async updateAdminLinkedPlayer(
			adminId: number,
			playerId: AdminProfile['playerId'],
			isMaster: boolean,
		) {
			const admin = await db.query.adminUsers.findFirst({
				where: eq(adminUsers.id, adminId),
				columns: { permissions: true },
			});

			if (!admin) throw new Error('not_found');
			if (admin.permissions & UserPermissions.MASTER && !isMaster)
				throw new Error('admin_is_master');

			const result = await db
				.update(adminUsers)
				.set({
					playerId,
				})
				.where(eq(adminUsers.id, adminId))
				.returning({ newPlayerId: adminUsers.playerId });

			if (!result[0]) throw new Error('not_found');

			return result[0];
		},
	};
}
