import type { AuthedRequest, RouteModule } from '../../../types';
import { sessionAuth } from '../../../middleware/session';
import AdminManagementModule from './admins';
import AuditLogModule from './audit';
import type {
	ApiResponse,
	SettingsKey,
	SettingsScope,
} from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import {
	SETTINGS_KEYS,
	SETTINGS_SCOPES,
	UserPermissions,
} from '@fxmanager/shared/constants';
import { repo } from '@fxmanager/database';

const SettingsEndpoints: RouteModule['handler'] = async (
	fastify,
	{ pm, gm },
) => {
	// enforces that admin key exists in request otherwise returns 401
	fastify.addHook('preHandler', sessionAuth);

	fastify.get(
		'/:scope',
		async (
			request,
		): Promise<ApiResponse<Record<SettingsKey, unknown> | undefined>> => {
			const { admin } = request as AuthedRequest;

			const allowed = PermissionManager.has(
				admin.permissions,
				UserPermissions.SETTINGS_ACCESS,
			);

			if (!allowed) throw new Error('Unauthorized');

			const { scope: rawScope } = request.params as { scope: string };

			if (!Object.keys(SETTINGS_SCOPES).includes(rawScope)) {
				throw new Error(`Invalid settings scope: ${rawScope}`);
			}

			const scope = rawScope as SettingsScope;
			const settingsKeys = SETTINGS_KEYS[scope] ?? [];
			const settings = repo.settings.getMultiple(settingsKeys);

			return { success: true, data: settings };
		},
	);

	fastify.post('/:scope', async (request): Promise<ApiResponse> => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.SETTINGS_ACCESS,
		);

		if (!allowed) throw new Error('Unauthorized');

		const { scope: rawScope } = request.params as { scope: string };
		if (!Object.keys(SETTINGS_SCOPES).includes(rawScope)) {
			throw new Error(`Invalid settings scope: ${rawScope}`);
		}

		const scope = rawScope as SettingsScope;
		const settingsKeys = (SETTINGS_KEYS[scope] ?? []).map((key) => key); // Done to avoid never.
		const { key, value } = request.body as { key: string; value: string };

		if (!settingsKeys.includes(key as SettingsKey)) {
			throw new Error(`Invalid settings key: ${key}`);
		}

		repo.settings.set(key, value);
		return { success: true, data: undefined };
	});

	fastify.register(AdminManagementModule.handler, {
		prefix: AdminManagementModule.prefix,
		pm,
		gm,
	});

	fastify.register(AuditLogModule.handler, {
		prefix: AuditLogModule.prefix,
		pm,
		gm,
	});
};

export default {
	prefix: '/settings',
	handler: SettingsEndpoints,
} satisfies RouteModule;
