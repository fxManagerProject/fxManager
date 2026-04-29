import type { AdminGroup, UserPermissionsType } from '@fxmanager/shared/types';
import {
	PERMISSION_GROUPS,
	UserPermissions,
} from '@fxmanager/shared/constants';

export const PermissionManager = {
	groups: PERMISSION_GROUPS,

	has(userBitfield: number, required: UserPermissionsType): boolean {
		if (userBitfield & UserPermissions.MASTER) return true;

		return (userBitfield & required) === required;
	},

	hasAll(userBitfield: number, required: UserPermissionsType[]): boolean {
		if (userBitfield & UserPermissions.MASTER) return true;

		const combined = required.reduce((acc, p) => acc | p, 0);

		return (userBitfield & combined) === combined;
	},

	grant(userBitfield: number, toAdd: UserPermissionsType): number {
		return userBitfield | toAdd;
	},

	revoke(userBitfield: number, toRemove: UserPermissionsType): number {
		return userBitfield & ~toRemove;
	},

	loadGroups(groups: AdminGroup[]) {
		PermissionManager.groups = groups;
	},

	getGroup(permission: number): AdminGroup | null {
		const group =
			PermissionManager.groups.find(
				(group) => (permission & group.permissions) === group.permissions,
			) ?? null;

		return group;
	},
};
