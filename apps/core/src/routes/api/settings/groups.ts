import { repo } from '@fxmanager/database';
import { UserPermissions } from '@fxmanager/shared/constants';
import type { AdminGroup, ApiResponse } from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import { aceSync } from '../../../modules/ace/manager';
import type { AuthedRequest, RouteModule } from '../../../types';

type GroupListEntry = AdminGroup & { memberCount: number; createdAt: Date };

interface GroupBody {
	name?: string;
	permissions?: number;
	colour?: string;
	icon?: string | null;
}

const GroupManagementEndpoints: RouteModule['handler'] = async (
	fastify,
	{ pm },
) => {
	const requireManagement = (request: unknown) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
		);

		if (!allowed) throw new Error('Unauthorized');

		return admin;
	};

	fastify.get('/', (request): ApiResponse<GroupListEntry[]> => {
		requireManagement(request);

		return { success: true, data: repo.groups.list() };
	});

	fastify.post(
		'/create',
		async (request): Promise<ApiResponse<AdminGroup>> => {
			const admin = requireManagement(request);

			const { name, permissions, colour, icon } = request.body as GroupBody;

			if (!name?.trim())
				return { success: false, error: 'Group name is required' };

			try {
				const group = repo.groups.create({
					name: name.trim(),
					permissions: permissions ?? 0,
					colour: colour ?? '#ffffff',
					icon,
				});

				repo.audit.log({
					adminId: admin.id,
					action: 'group.create',
					metadata: { name: group.name, permissions: group.permissions },
				});

				aceSync.resync(pm);

				return { success: true, data: group };
			} catch (err) {
				const message = (err as Error).message;
				return {
					success: false,
					error: message.includes('UNIQUE constraint failed')
						? 'Group name is already taken'
						: message,
				};
			}
		},
	);

	fastify.post(
		'/:groupId/update',
		async (request): Promise<ApiResponse<AdminGroup>> => {
			const admin = requireManagement(request);

			const { groupId: groupIdRaw } = request.params as { groupId: string };
			const groupId = parseInt(groupIdRaw, 10);
			const { name, permissions, colour, icon } = request.body as GroupBody;

			if (name !== undefined && !name.trim())
				return { success: false, error: 'Group name is required' };

			try {
				const previous = repo.groups.get(groupId);
				const group = repo.groups.update(groupId, {
					name: name?.trim(),
					permissions,
					colour,
					icon,
				});

				repo.audit.log({
					adminId: admin.id,
					action: 'group.update',
					metadata: {
						name: group.name,
						previous_permissions: previous?.permissions,
						new_permissions: group.permissions,
					},
				});

				aceSync.resync(pm);

				return { success: true, data: group };
			} catch (err) {
				const message = (err as Error).message;

				if (message === 'not_found')
					return { success: false, error: 'Group not found' };
				if (message.includes('UNIQUE constraint failed'))
					return { success: false, error: 'Group name is already taken' };

				throw err;
			}
		},
	);

	fastify.post('/:groupId/delete', async (request): Promise<ApiResponse> => {
		const admin = requireManagement(request);

		const { groupId: groupIdRaw } = request.params as { groupId: string };
		const groupId = parseInt(groupIdRaw, 10);

		try {
			const deleted = repo.groups.delete(groupId);

			repo.audit.log({
				adminId: admin.id,
				action: 'group.delete',
				metadata: { name: deleted.name, id: deleted.id },
			});

			aceSync.resync(pm);

			return { success: true, data: undefined };
		} catch (err) {
			const message = (err as Error).message;

			switch (message) {
				case 'not_found':
					return { success: false, error: 'Group not found' };
				case 'group_in_use':
					return {
						success: false,
						error: 'Group still has members, reassign them first',
					};
				default:
					throw err;
			}
		}
	});
};

export default {
	prefix: '/groups',
	handler: GroupManagementEndpoints,
} satisfies RouteModule;
