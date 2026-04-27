import type {
	AuthedRequest,
	RouteModule,
	SearchQueryRequest,
} from '../../../types';
import { sessionAuth } from '../../../middleware/session';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import type {
	ApiResponse,
	BaseAdminUser,
	CreateAdminForm,
	PaginatedResponse,
} from '@fxmanager/shared/types';
import { repo } from '@fxmanager/database';
import { generatePassword } from '../../../common/utils';
import type { AdminProfile } from '@fxmanager/database/types';

const AdminManagementEndpoints: RouteModule['handler'] = async (fastify) => {
	fastify.get('/', (request, reply): PaginatedResponse<BaseAdminUser> => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
		);

		if (!allowed) throw new Error('Unauthorized');

		const { query } = request as SearchQueryRequest;

		const page = Number(query.page ?? 1);
		const pageSize = Number(query.pageSize ?? 50);

		return repo.settings.listAdmins(page, pageSize, {
			search: query.search,
			sortBy: query.sortBy as any,
			sortOrder: query.sortOrder as any,
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

			const { username, permissions } = request.body as CreateAdminForm;
			const password = generatePassword(20);

			try {
				const profile = await repo.auth.createUser(
					username,
					password,
					permissions,
					false,
				);

				return {
					success: true,
					data: {
						id: profile.id,
						password,
					},
				};
			} catch (err) {
				const message = (err as Error).message;
				return {
					success: false,
					error: message.includes('UNIQUE constraint failed')
						? 'Username is already taken'
						: message,
				};
			}
		},
	);

	fastify.get('/:adminId', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
		);

		if (!allowed) throw new Error('Unauthorized');

		const { adminId: adminIdRaw } = request.params as { adminId: string };
		const adminId = parseInt(adminIdRaw);

		const profile = await repo.settings.getAdminProfile(adminId);

		if (!profile)
			return {
				success: false,
				error: `Admin id ${adminId} does not exist.`,
			};

		return { success: true, data: profile };
	});

	fastify.post(
		'/:adminId/permissions',
		async (request, reply): Promise<ApiResponse<number>> => {
			const { admin } = request as AuthedRequest;
			const { adminId: adminIdRaw } = request.params as { adminId: string };
			const { permissions } = request.body as { permissions: number };
			const adminId = parseInt(adminIdRaw);

			const allowed = PermissionManager.has(
				admin.permissions,
				UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
			);

			if (!allowed) throw new Error('Unauthorized');

			try {
				const { newPerms } = await repo.settings.updateAdminPermissions(
					adminId,
					permissions,
				);

				return {
					success: true,
					data: newPerms,
				};
			} catch (err) {
				const msg = (err as Error).message;

				if (msg === 'not_found')
					return { success: false, error: 'Admin not found' };
				else if (msg === 'admin_is_master')
					return {
						success: false,
						error: 'Can not change permissions of master account',
					};
				else throw err;
			}
		},
	);

	fastify.post(
		'/:adminId/player',
		async (
			request,
			reply,
		): Promise<ApiResponse<{ newPlayerId: AdminProfile['playerId'] }>> => {
			const { admin } = request as AuthedRequest;
			const { adminId: adminIdRaw } = request.params as { adminId: string };
			const { playerId } = request.body as {
				playerId: AdminProfile['playerId'];
			};
			const adminId = parseInt(adminIdRaw);

			const allowed = PermissionManager.has(
				admin.permissions,
				UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
			);

			if (!allowed) throw new Error('Unauthorized');

			try {
				const { newPlayerId } = await repo.settings.updateAdminLinkedPlayer(
					adminId,
					playerId,
					PermissionManager.has(admin.permissions, UserPermissions.MASTER),
				);

				return {
					success: true,
					data: { newPlayerId },
				};
			} catch (err) {
				const msg = (err as Error).message;

				if (msg === 'not_found')
					return { success: false, error: 'Admin not found' };
				else if (msg === 'admin_is_master')
					return {
						success: false,
						error: 'Can not change permissions of master account',
					};
				else throw err;
			}
		},
	);

	fastify.post(
		'/:adminId/delete',
		async (request): Promise<ApiResponse<undefined>> => {
			const { admin } = request as AuthedRequest;
			const { adminId: adminIdRaw } = request.params as { adminId: string };
			const adminId = parseInt(adminIdRaw);

			const allowed = PermissionManager.has(
				admin.permissions,
				UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
			);

			if (!allowed) throw new Error('Unauthorized');

			try {
				await repo.auth.deleteUser(adminId);

				return {
					success: true,
					data: undefined,
				};
			} catch (err) {
				const msg = (err as Error).message;

				if (msg === 'not_found')
					return { success: false, error: 'Admin not found' };
				else if (msg === 'admin_is_master')
					return {
						success: false,
						error: 'Cannot delete master account',
					};
				else throw err;
			}
		},
	);
};

export default {
	prefix: '/admins',
	handler: AdminManagementEndpoints,
} satisfies RouteModule;
