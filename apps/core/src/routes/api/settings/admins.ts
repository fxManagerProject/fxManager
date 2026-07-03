import { repo } from '@fxmanager/database';
import type { AdminProfile } from '@fxmanager/database/types';
import { UserPermissions } from '@fxmanager/shared/constants';
import type {
	ApiResponse,
	BaseAdminUser,
	CreateAdminForm,
	PaginatedResponse,
} from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import { generatePassword } from '../../../common/utils';
import { aceSync } from '../../../modules/ace/manager';
import type {
	AuthedRequest,
	RouteModule,
	SearchQueryRequest,
} from '../../../types';

const AdminManagementEndpoints: RouteModule['handler'] = async (
	fastify,
	{ pm },
) => {
	fastify.get('/', (request): PaginatedResponse<BaseAdminUser> => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
		);

		if (!allowed) throw new Error('Unauthorized');

		const { query } = request as SearchQueryRequest<
			'createdAt' | 'lastLoginAt' | undefined
		>;

		const page = Number(query.page ?? 1);
		const pageSize = Number(query.pageSize ?? 50);

		return repo.admins.list(page, pageSize, {
			search: query.search,
			sortBy: query.sortBy,
			sortOrder: query.sortOrder,
		});
	});

	fastify.post(
		'/create',
		async (request): Promise<ApiResponse<{ id: number; password: string }>> => {
			const { admin } = request as AuthedRequest;

			const allowed = PermissionManager.has(
				admin.permissions,
				UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
			);

			if (!allowed) throw new Error('Unauthorized');

			const { username, permissions, groupId, playerId } =
				request.body as CreateAdminForm;
			const password = generatePassword(20);

			if (groupId != null && !repo.groups.get(groupId))
				return { success: false, error: 'Group not found' };

			const storedPermissions = groupId != null ? 0 : permissions;

			try {
				const profile = await repo.auth.createUser(
					username,
					password,
					storedPermissions,
					false,
					playerId ?? null,
				);

				if (groupId != null) {
					await repo.admins.assignGroup(profile.id, groupId);
				}

				if (groupId != null || playerId != null) aceSync.resync(pm);

				repo.audit.log({
					adminId: admin.id,
					action: 'admin.create',
					metadata: {
						username,
						permissions: storedPermissions,
						groupId,
						playerId,
					},
				});

				return {
					success: true,
					data: {
						id: profile.id,
						password,
					},
				};
			} catch (err) {
				const message = (err as Error).message;
				if (message.includes('UNIQUE constraint failed'))
					return { success: false, error: 'Username is already taken' };
				if (message.includes('FOREIGN KEY constraint failed'))
					return { success: false, error: 'Selected player not found' };
				return { success: false, error: message };
			}
		},
	);

	fastify.get('/:adminId', async (request) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
		);

		if (!allowed) throw new Error('Unauthorized');

		const { adminId: adminIdRaw } = request.params as { adminId: string };
		const adminId = parseInt(adminIdRaw, 10);

		const profile = await repo.admins.getProfile(
			adminId,
			PermissionManager.has(admin.permissions, UserPermissions.AUDIT_LOG),
		);

		if (!profile)
			return {
				success: false,
				error: `Admin id ${adminId} does not exist.`,
			};

		return { success: true, data: profile };
	});

	fastify.post(
		'/:adminId/permissions',
		async (request): Promise<ApiResponse<number>> => {
			const { admin } = request as AuthedRequest;
			const { adminId: adminIdRaw } = request.params as { adminId: string };
			const { permissions } = request.body as { permissions: number };
			const adminId = parseInt(adminIdRaw, 10);

			const allowed = PermissionManager.has(
				admin.permissions,
				UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
			);

			if (!allowed) throw new Error('Unauthorized');

			try {
				const { newPermissions, oldPermissions, username } =
					await repo.admins.updatePermissions(adminId, permissions);

				repo.audit.log({
					adminId: admin.id,
					action: 'admin.update',
					metadata: {
						target: username,
						previous_permissions: oldPermissions,
						new_permissions: newPermissions,
					},
				});

				aceSync.resync(pm);

				return {
					success: true,
					data: newPermissions,
				};
			} catch (err) {
				const msg = (err as Error).message;

				switch (msg) {
					case 'not_found':
						return { success: false, error: 'Admin not found' };
					case 'admin_is_master':
						return {
							success: false,
							error: 'Can not change permissions of master account',
						};
					default:
						throw err;
				}
			}
		},
	);

	fastify.post(
		'/:adminId/player',
		async (
			request,
		): Promise<ApiResponse<{ newPlayerId: AdminProfile['playerId'] }>> => {
			const { admin } = request as AuthedRequest;
			const { adminId: adminIdRaw } = request.params as { adminId: string };
			const { playerId } = request.body as {
				playerId: AdminProfile['playerId'];
			};
			const adminId = parseInt(adminIdRaw, 10);

			const allowed = PermissionManager.has(
				admin.permissions,
				UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
			);

			if (!allowed) throw new Error('Unauthorized');

			try {
				const { username, newPlayerId, previousPlayerId } =
					await repo.admins.updateLinkedPlayer(
						adminId,
						playerId,
						PermissionManager.has(admin.permissions, UserPermissions.MASTER),
					);

				repo.audit.log({
					adminId: admin.id,
					action: 'admin.update',
					metadata: {
						target: username,
						previous_playerId: newPlayerId,
						new_playerId: previousPlayerId,
					},
				});

				aceSync.resync(pm);

				return {
					success: true,
					data: { newPlayerId },
				};
			} catch (err) {
				const msg = (err as Error).message;

				switch (msg) {
					case 'not_found':
						return { success: false, error: 'Admin not found' };
					case 'admin_is_master':
						return {
							success: false,
							error: 'Can not change permissions of master account',
						};
					default:
						throw err;
				}
			}
		},
	);

	fastify.post(
		'/:adminId/group',
		async (request): Promise<ApiResponse<{ newGroupId: number | null }>> => {
			const { admin } = request as AuthedRequest;
			const { adminId: adminIdRaw } = request.params as { adminId: string };
			const { groupId } = request.body as { groupId: number | null };
			const adminId = parseInt(adminIdRaw, 10);

			const allowed = PermissionManager.has(
				admin.permissions,
				UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
			);

			if (!allowed) throw new Error('Unauthorized');

			try {
				const { username, previousGroupId, newGroupId } =
					await repo.admins.assignGroup(adminId, groupId ?? null);

				repo.audit.log({
					adminId: admin.id,
					action: 'admin.update',
					metadata: {
						target: username,
						previous_groupId: previousGroupId,
						new_groupId: newGroupId,
					},
				});

				aceSync.resync(pm);

				return {
					success: true,
					data: { newGroupId },
				};
			} catch (err) {
				const msg = (err as Error).message;

				switch (msg) {
					case 'not_found':
						return { success: false, error: 'Admin not found' };
					case 'group_not_found':
						return { success: false, error: 'Group not found' };
					case 'admin_is_master':
						return {
							success: false,
							error: 'Can not change permissions of master account',
						};
					default:
						throw err;
				}
			}
		},
	);

	fastify.post('/:adminId/delete', async (request): Promise<ApiResponse> => {
		const { admin } = request as AuthedRequest;
		const { adminId: adminIdRaw } = request.params as { adminId: string };
		const adminId = parseInt(adminIdRaw, 10);

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
		);

		if (!allowed) throw new Error('Unauthorized');

		try {
			const deletedUser = await repo.auth.deleteUser(adminId);

			if (!deletedUser) throw new Error('not_found');

			repo.audit.log({
				adminId: admin.id,
				action: 'admin.delete',
				metadata: { target: deletedUser.username, id: deletedUser.id },
			});

			aceSync.resync(pm);

			return {
				success: true,
				data: undefined,
			};
		} catch (err) {
			const msg = (err as Error).message;

			switch (msg) {
				case 'not_found':
					return { success: false, error: 'Admin not found' };
				case 'admin_is_master':
					return { success: false, error: 'Cannot delete master account' };
				default:
					throw err;
			}
		}
	});
};

export default {
	prefix: '/admins',
	handler: AdminManagementEndpoints,
} satisfies RouteModule;
