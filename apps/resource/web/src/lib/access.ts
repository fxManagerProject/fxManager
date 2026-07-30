import { PERMISSION_ACE_KEYS } from '@fxmanager/shared/constants';

export type FxPermission =
	| typeof PERMISSION_ACE_KEYS[keyof typeof PERMISSION_ACE_KEYS]
	| 'MASTER';

export type Permissions = FxPermission[];

export function canAccess(userPermissions: Permissions, requiredPermission: FxPermission): boolean {
	if (userPermissions.includes('MASTER')) {
		return true;
	}

	return userPermissions.includes(requiredPermission);
}
