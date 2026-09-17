import {
	ACE_PREFIX,
	PERMISSION_ACE_KEYS,
	UserPermissions,
} from '@fxmanager/shared/constants';

export interface CallbackPayload<T = unknown> {
	requestId: string;
	name: string;
	payload: T;
}

export interface CallbackResponse<T = unknown> {
	requestId: string;
	success: boolean;
	data?: T;
	error?: string;
}

export const EVENT_NAMES = {
	CLIENT_TO_SERVER_REQ: 'fxmanager:cb:c2s:req',
	CLIENT_TO_SERVER_RES: 'fxmanager:cb:c2s:res',
	SERVER_TO_CLIENT_REQ: 'fxmanager:cb:s2c:req',
	SERVER_TO_CLIENT_RES: 'fxmanager:cb:s2c:res',
} as const;

export type UserPermissionKey = keyof typeof UserPermissions;

/** validate whether a player holds a given permission key */
export function hasPermission(
	src: number | string,
	permKey: UserPermissionKey,
): boolean {
	const bit = UserPermissions[permKey];
	if (!bit || bit === UserPermissions.NONE) return false;

	// Check master override or specific ACE key
	if (globalThis.IsPlayerAceAllowed(String(src), ACE_PREFIX)) return true;

	const aceSuffix = PERMISSION_ACE_KEYS[bit];
	if (!aceSuffix) return false;

	return globalThis.IsPlayerAceAllowed(
		String(src),
		`${ACE_PREFIX}.${aceSuffix}`,
	);
}
