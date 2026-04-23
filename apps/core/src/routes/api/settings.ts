import type {
	AuthedRequest,
	RouteModule,
	SearchQueryRequest,
} from '../../types';
import { sessionAuth } from '../../middleware/session';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import type {
	ApiResponse,
	BaseAdminUser,
	PaginatedResponse,
} from '@fxmanager/shared/types';
import { repo } from '@fxmanager/database';

const SettingsEndpoints: RouteModule['handler'] = async (fastify) => {
	// enforces that admin key exists in request otherwise returns 401
	fastify.addHook('preHandler', sessionAuth);

	fastify.get('/admins', (request, reply): PaginatedResponse<BaseAdminUser> => {
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

	fastify.get('/admins/:adminId', async (request, reply) => {
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
		'/admins/:adminId/permissions',
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
};

export default {
	prefix: '/settings',
	handler: SettingsEndpoints,
} satisfies RouteModule;
