import { and, asc, desc, eq, inArray, like, sql } from 'drizzle-orm';
import type { BaseAdminUser, PaginatedResponse } from '@fxmanager/shared/types';
import type * as schema from '../schema';
import {
	adminGroups,
	adminUsers,
	auditLog,
	playerIdentifiers,
	players,
} from '../schema';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { PermissionManager } from '@fxmanager/shared/utils';
import type { AdminProfile, AuditLog } from '../types';
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
				group: {
					id: adminGroups.id,
					name: adminGroups.name,
					permissions: adminGroups.permissions,
					colour: adminGroups.colour,
					icon: adminGroups.icon,
				},
			})
			.from(adminUsers)
			.leftJoin(adminGroups, eq(adminUsers.groupId, adminGroups.id))
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
				effectivePermissions: PermissionManager.effective(
					admin.permissions,
					admin.group?.permissions,
				),
			})),
			total,
			page,
			pageSize,
		};
	}

	async getProfile(
		adminId: number,
		showAudit: boolean = false,
	): Promise<AdminProfile | null> {
		const profile = await this.db.query.adminUsers.findFirst({
			where: eq(adminUsers.id, adminId),
			columns: {
				id: true,
				username: true,
				passwordHash: false,
				permissions: true,
				playerId: true,
				createdAt: true,
				lastLoginAt: true,
			},
			with: {
				group: {
					columns: {
						id: true,
						name: true,
						permissions: true,
						colour: true,
						icon: true,
					},
				},
			},
		});

		if (!profile) return null;

		let playerName: string | null = null;
		if (profile.playerId) {
			const adminPlayer = await this.db.query.players.findFirst({
				where: eq(players.id, profile.playerId),
				columns: { name: true },
			});
			playerName = adminPlayer?.name ?? null;
		}

		let auditLogs: AuditLog[] = [];

		if (showAudit) {
			const rawLogs = this.db
				.select()
				.from(auditLog)
				.where(eq(auditLog.adminId, adminId))
				.orderBy(desc(auditLog.createdAt))
				.limit(10)
				.all();

			if (rawLogs.length > 0) {
				const targetPlayerIds = [
					...new Set(
						rawLogs
							.map((log) => log.playerId)
							.filter((id): id is number => id !== null),
					),
				];

				const playersData =
					targetPlayerIds.length > 0
						? this.db
								.select({ id: players.id, name: players.name })
								.from(players)
								.where(inArray(players.id, targetPlayerIds))
								.all()
						: [];

				const playerMap = new Map(playersData.map((p) => [p.id, p.name]));

				auditLogs = rawLogs.map((log) => ({
					...log,
					admin: profile.username,
					player: log.playerId ? (playerMap.get(log.playerId) ?? null) : null,
				}));
			}
		}

		return {
			...profile,
			auditLogs,
			playerName,
			group: profile.group ?? null,
			effectivePermissions: PermissionManager.effective(
				profile.permissions,
				profile.group?.permissions,
			),
		};
	}

	async assignGroup(adminId: number, groupId: number | null) {
		const admin = await this.db.query.adminUsers.findFirst({
			where: eq(adminUsers.id, adminId),
			columns: { permissions: true, groupId: true },
		});

		if (!admin) throw new Error('not_found');
		if (PermissionManager.isMaster(admin.permissions))
			throw new Error('admin_is_master');

		if (groupId !== null) {
			const group = this.db
				.select({ id: adminGroups.id })
				.from(adminGroups)
				.where(eq(adminGroups.id, groupId))
				.get();

			if (!group) throw new Error('group_not_found');
		}

		const result = await this.db
			.update(adminUsers)
			.set({ groupId, ...(groupId !== null && { permissions: 0 }) })
			.where(eq(adminUsers.id, adminId))
			.returning();

		if (!result[0]) throw new Error('not_found');

		return {
			...result[0],
			previousGroupId: admin.groupId,
			newGroupId: groupId,
		};
	}

	listForAceSync() {
		return this.db
			.select({
				id: adminUsers.id,
				username: adminUsers.username,
				permissions: adminUsers.permissions,
				groupId: adminUsers.groupId,
				license: playerIdentifiers.value,
			})
			.from(adminUsers)
			.leftJoin(
				playerIdentifiers,
				and(
					eq(playerIdentifiers.playerId, adminUsers.playerId),
					eq(playerIdentifiers.type, 'license'),
				),
			)
			.all();
	}

	async updatePermissions(adminId: number, newPerms: number) {
		const admin = await this.db.query.adminUsers.findFirst({
			where: eq(adminUsers.id, adminId),
			columns: { permissions: true },
		});

		if (!admin) throw new Error('not_found');
		if (PermissionManager.isMaster(admin.permissions))
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
			columns: { permissions: true, playerId: true },
		});

		if (!admin) throw new Error('not_found');
		if (PermissionManager.isMaster(admin.permissions) && !isMaster)
			throw new Error('admin_is_master');

		const result = await this.db
			.update(adminUsers)
			.set({
				playerId,
			})
			.where(eq(adminUsers.id, adminId))
			.returning();

		if (!result[0]) throw new Error('not_found');

		return {
			...result[0],
			previousPlayerId: admin.playerId,
			newPlayerId: playerId,
		};
	}
}

export function createAdminsRepository(db: DB) {
	return AdminsRepository.getInstance(db);
}
