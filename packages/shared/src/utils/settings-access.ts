import type { SettingsKey } from '../types';
import { SETTINGS_MASTER_ONLY_KEYS, UserPermissions } from '../constants';
import { PermissionManager } from './permissions';

export function canWriteSetting(
	key: SettingsKey,
	permissions: number,
): boolean {
	if (SETTINGS_MASTER_ONLY_KEYS.includes(key)) {
		return PermissionManager.isMaster(permissions);
	}

	return PermissionManager.has(permissions, UserPermissions.SETTINGS_ACCESS);
}
