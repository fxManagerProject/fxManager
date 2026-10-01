import {
	CALLBACK_NAMES,
	EVENT_NAMES,
	NUI_PERMISSIONS_EVENT,
	type PermissionSnapshot,
	type UserPermissionKey,
} from '@common/types';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionManager as PM } from '@fxmanager/shared/utils';
import { ClientCallbacks } from './callbacks';

class PermissionManager {
	permissions = 0;

	constructor() {
		this.init();
	}

	private async init() {
		onNet(EVENT_NAMES.S2C_PERMISSIONS_UPDATED, async () => {
			await this.refresh();
		});

		setTimeout(async () => {
			await this.refresh();
		}, 0);
	}

	private async refresh() {
		const snapshot = await ClientCallbacks.trigger<PermissionSnapshot>(
			CALLBACK_NAMES.GET_PERMISSIONS,
			undefined,
			{ fallback: { permissions: 0 } },
		);

		this.permissions = snapshot.permissions;

		SendNUIMessage(
			JSON.stringify({
				action: NUI_PERMISSIONS_EVENT,
				data: snapshot.permissions,
			}),
		);
	}

	getPermissions() {
		return this.permissions;
	}

	has(permissionKey: UserPermissionKey): boolean {
		return PM.has(this.permissions, UserPermissions[permissionKey]);
	}
}

export const permissions = new PermissionManager();
