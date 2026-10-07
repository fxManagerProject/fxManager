import { UserPermissions } from '@fxmanager/shared/constants';

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

	/** server -> client notification that the player's permissions changed */
	S2C_PERMISSIONS_UPDATED: 'fxmanager:s2c:permissions:updated',
} as const;

/** callback names registered on the server and triggered by the client */
export const CALLBACK_NAMES = {
	/** fetch the calling player's permission snapshot (bitfield + ace keys) */
	GET_PERMISSIONS: 'get-permissions',
	TOGGLE_NOCLIP: 'toggle-noclip',
	TELEPORT_COORDS: 'teleport-coords',
} as const;

/** bare NUI callback action used for the SendNUIMessage permissions push */
export const NUI_PERMISSIONS_EVENT = 'permissions';

export interface PermissionSnapshot {
	/** raw UserPermissions bitfield, see @fxmanager/shared/constants */
	permissions: number;
}

export type UserPermissionKey = keyof typeof UserPermissions;
