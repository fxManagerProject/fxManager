import type { AuthedRequest, RouteModule } from '../../../types';
import { sessionAuth } from '../../../middleware/session';
import AdminManagementModule from './admins';
import GroupManagementModule from './groups';
import AuditLogModule from './audit';
import type {
	ApiResponse,
	SettingsKey,
	SettingsScope,
} from '@fxmanager/shared/types';
import {
	PermissionManager,
	canWriteSetting,
	validateStartupArguments,
} from '@fxmanager/shared/utils';
import {
	SETTINGS_KEYS,
	SETTINGS_SCOPES,
	SETTINGS_SENSITIVE_KEYS,
	UserPermissions,
} from '@fxmanager/shared/constants';
import { repo } from '@fxmanager/database';
import { restartScheduler } from '../../../modules/schedule/manager';
import { ConfigManager } from '../../../modules/config/manager';

interface HookResult {
	valid: boolean;
	[key: string]: unknown;
}

const SETTINGS_HOOKS: Partial<
	Record<SettingsKey, (value: string) => Promise<HookResult> | HookResult>
> = {
	'fxserver.startupArguments': validateStartupArguments,
	'fxserver.executablePath': async (value: string) => {
		const config = ConfigManager.getInstance();
		const result = await config.validateExecutablePath(value);

		return {
			valid: result.valid,
			correctedValue: result.path,
		};
	},
	'fxserver.serverDataPath': async (value: string) => {
		const config = ConfigManager.getInstance();
		const result = await config.validateDataPath(value);

		return {
			valid: result.valid,
			correctedValue: result.path,
		};
	},
	'fxserver.serverConfigPath': async (value: string) => {
		const config = ConfigManager.getInstance();
		const result = await config.validateConfigPath(value);

		return {
			valid: result.valid,
			correctedValue: result.path,
		};
	},
};

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

		if (!canWriteSetting(key as SettingsKey, admin.permissions)) {
			throw new Error('Unauthorized');
		}

		const hook = SETTINGS_HOOKS[key as SettingsKey];
		const hookResult = hook && (await hook(value));
		if (hookResult && !hookResult.valid) {
			throw new Error('Invalid value');
		}

		const newValue =
			hookResult && hookResult?.correctedValue
				? hookResult.correctedValue
				: value;

		repo.settings.set(key, newValue);

		const logValue = SETTINGS_SENSITIVE_KEYS.includes(key as SettingsKey)
			? 'REDACTED'
			: newValue;

		repo.audit.log({
			adminId: admin.id,
			action: 'settings.update',
			metadata: { key, value: logValue },
		});

		if (scope === 'restarts') restartScheduler.reload();

		return {
			success: true,
			data: hookResult?.correctedValue && {
				correctedValue: hookResult.correctedValue,
			},
		};
	});

	fastify.register(AdminManagementModule.handler, {
		prefix: AdminManagementModule.prefix,
		pm,
		gm,
	});

	fastify.register(GroupManagementModule.handler, {
		prefix: GroupManagementModule.prefix,
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
