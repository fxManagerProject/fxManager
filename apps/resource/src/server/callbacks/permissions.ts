import { CALLBACK_NAMES, type PermissionSnapshot } from '@common/types';
import { ServerCallbacks } from '../utils/callbacks';
import { getPermissions, permissionsToAceKeys } from '../utils/permissions';

/**
 * Registers the callback the client uses to sync its permissions.
 */
ServerCallbacks.register<undefined, PermissionSnapshot>(
	CALLBACK_NAMES.GET_PERMISSIONS,
	(source) => {
		const permissions = getPermissions(source);

		return {
			permissions,
			acePermissions: permissionsToAceKeys(permissions),
		};
	},
);
