import { asc, desc, eq, like, sql } from 'drizzle-orm';
import type { BaseAdminUser, PaginatedResponse } from '@fxmanager/shared/types';
import type * as schema from '../schema';
import { adminUsers, auditLog, players } from '../schema';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { PermissionManager } from '@fxmanager/shared/utils';
import type { AdminProfile } from '../types';
import { UserPermissions } from '@fxmanager/shared/constants';

type DB = BunSQLiteDatabase<typeof schema>;

class AdminsRepository {
	private static instance: AdminsRepository;

	private constructor(private readonly db: DB) {}

	static getInstance(db: DB): AdminsRepository {
		if (!AdminsRepository.instance) {
			AdminsRepository.instance = new AdminsRepository(db);
		}

		return AdminsRepository.instance;
	}

	list(
		page = 1,
		pageSize = 20,
		options?: {
			search?: string;
			sortBy?: 'createdAt' | 'lastLoginAt';
			sortOrder?: 'asc' | 'desc';
		},
	): PaginatedResponse<BaseAdminUser> {
		const { search, sortBy = 'createdAt', sortOrder = 'desc' } = options ?? {};

		const sortCol = {
			createdAt: adminUsers.createdAt,
			lastLoginAt: adminUsers.lastLoginAt,
		}[sortBy];

		const orderFn = sortOrder === 'asc' ? asc : desc;

		const filters = search
			? like(adminUsers.username, `%${search}%`)
			: undefined;

		const countQuery = this.db
			.select({ count: sql<number>`count(distinct ${adminUsers.id})` })
			.from(adminUsers)
			.where(filters);

		const totalResult = countQuery.get();
		const total = totalResult?.count ?? 0;

		const query = this.db
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
	}

	async getProfile(adminId: number): Promise<AdminProfile | null> {
		const profile = await this.db.query.adminUsers.findFirst({
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

		const response = profile.playerId
			? await this.db.query.players.findFirst({
					where: eq(players.id, profile.playerId),
					columns: { name: true },
				})
			: null;

		return {
			...profile,
			playerName: response?.name ?? null,
			group: PermissionManager.getGroup(profile.permissions),
		};
	}

	async updatePermissions(adminId: number, newPerms: number) {
		const admin = await this.db.query.adminUsers.findFirst({
			where: eq(adminUsers.id, adminId),
			columns: { permissions: true },
		});

		if (!admin) throw new Error('not_found');
		if (admin.permissions & UserPermissions.MASTER)
			throw new Error('admin_is_master');

		// failsafe final check, don't set master permission
		const sanitizedPerms = newPerms & ~UserPermissions.MASTER;

		const result = await this.db
			.update(adminUsers)
			.set({
				permissions: sanitizedPerms,
			})
			.where(eq(adminUsers.id, adminId))
			.returning();

		if (!result[0]) throw new Error('not_found');

		return {
			...result[0],
			oldPermissions: admin.permissions,
			newPermissions: sanitizedPerms,
		};
	}

	async updateLinkedPlayer(
		adminId: number,
		playerId: AdminProfile['playerId'],
		isMaster: boolean,
	) {
		const admin = await this.db.query.adminUsers.findFirst({
			where: eq(adminUsers.id, adminId),
			columns: { permissions: true },
		});

		if (!admin) throw new Error('not_found');
		if (admin.permissions & UserPermissions.MASTER && !isMaster)
			throw new Error('admin_is_master');

		const result = await this.db
			.update(adminUsers)
			.set({
				playerId,
			})
			.where(eq(adminUsers.id, adminId))
			.returning({ newPlayerId: adminUsers.playerId });

		if (!result[0]) throw new Error('not_found');

		return result[0];
	}
}

export function createAdminsRepository(db: DB) {
	return AdminsRepository.getInstance(db);
}
