import { repo } from '@fxmanager/database';
import type { AdminProfile } from '@fxmanager/database/types';
import { UserPermissions } from '@fxmanager/shared/constants';
import type { ApiResponse } from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import type { AuthedRequest, RouteModule } from '../../../types';

const ProfileEndpoints: RouteModule['handler'] = async (fastify, { pm }) => {
	fastify.get('/', async (request) => {
		const { admin } = request as AuthedRequest;

		const profile = await repo.admins.getProfile(
			admin.id,
			PermissionManager.has(admin.permissions, UserPermissions.AUDIT_LOG),
		);

		if (!profile)
			return {
				success: false,
				error: `Admin id ${admin.id} does not exist.`,
			};

		return { success: true, data: profile };
	});

	fastify.post('/password', async (request) => {
		const { admin } = request as AuthedRequest;
		const { currentPassword, newPassword } = request.body as {
			currentPassword: string;
			newPassword: string;
		};

		const data = await repo.auth.verifyPassword(
			admin.username,
			currentPassword,
		);

		if (!data) return { success: false, error: 'Invalid current password' };

		await repo.auth.updatePassword(admin.id, newPassword);

		return { success: true };
	});

	fastify.post(
		'/identifiers',
		async (
			request,
		): Promise<
			ApiResponse<{
				newCfxId: AdminProfile['cfxId'];
				newDiscordId: AdminProfile['discordId'];
			}>
		> => {
			const { admin } = request as AuthedRequest;
			const { cfxId, discordId } = request.body as {
				cfxId: AdminProfile['cfxId'];
				discordId: AdminProfile['discordId'];
			};

			try {
				const { newCfxId, newDiscordId, previousCfxId, previousDiscordId } =
					await repo.admins.updateIdentifiers(admin.id, cfxId, discordId);

				repo.audit.log({
					adminId: admin.id,
					action: 'admin.update',
					metadata: {
						new_cfxId: newCfxId ?? (previousCfxId ? 'removed' : undefined),
						new_discordId:
							newDiscordId ?? (previousDiscordId ? 'removed' : undefined),
						previous_cfxId: previousCfxId ?? undefined,
						previous_discordId: previousDiscordId ?? undefined,
					},
				});

				return {
					success: true,
					data: { newDiscordId, newCfxId },
				};
			} catch (err) {
				const msg = (err as Error).message;

				switch (msg) {
					case 'not_found':
						return { success: false, error: 'Admin not found' };
					case 'UNIQUE constraint failed: admin_users.discord_id':
					case 'UNIQUE constraint failed: admin_users.cfx_id':
						return {
							success: false,
							error: 'Identifier already registered',
						};
					case 'invalid_cfx_id':
					case 'invalid_discord_id':
						return {
							success: false,
							error: 'Identifier format is invalid',
						};
					default:
						console.error('Failed to update profile identifier:', {
							by: admin,
							data: { cfxId, discordId },
							error: msg,
						});
						throw err;
				}
			}
		},
	);
};

export default {
	prefix: '/profile',
	handler: ProfileEndpoints,
} satisfies RouteModule;
