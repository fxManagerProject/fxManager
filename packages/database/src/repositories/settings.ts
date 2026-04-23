import { asc, desc, eq, like, or, sql } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { settings, adminUsers } from '../schema';
import type * as schema from '../schema';
import { BaseAdminUser, PaginatedResponse } from '@fxmanager/shared/types';

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
				.from(adminUsers);

			const totalResult = countQuery.get();
			const total = totalResult?.count ?? 0;

			let query = db
				.select({
					id: adminUsers.id,
					username: adminUsers.username,
					permissions: adminUsers.permissions,
					playerId: adminUsers.playerId,
					createdAt: adminUsers.createdAt,
					lastLoginAt: adminUsers.lastLoginAt,
				})
				.from(adminUsers)
				.$dynamic();

			const response = query
				.orderBy(orderFn(sortCol))
				.limit(pageSize)
				.offset((page - 1) * pageSize)
				.all();

			return {
				items: response,
				total,
				page,
				pageSize,
			};
		},
	};
}
