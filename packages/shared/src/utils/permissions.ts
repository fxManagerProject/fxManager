import type { UserPermissionsType } from '@fxmanager/shared/types';
import { UserPermissions } from '@fxmanager/shared/constants';

export const PermissionManager = {
	isMaster(userBitfield: number): boolean {
		return (userBitfield & UserPermissions.MASTER) !== 0;
	},

	has(userBitfield: number, required: UserPermissionsType): boolean {
		if (PermissionManager.isMaster(userBitfield)) return true;

		return (userBitfield & required) === required;
	},

	hasAll(userBitfield: number, required: UserPermissionsType[]): boolean {
		if (PermissionManager.isMaster(userBitfield)) return true;

		const combined = required.reduce((acc, p) => acc | p, 0);

		return (userBitfield & combined) === combined;
	},

	grant(userBitfield: number, toAdd: UserPermissionsType): number {
		return userBitfield | toAdd;
	},

	revoke(userBitfield: number, toRemove: UserPermissionsType): number {
		return userBitfield & ~toRemove;
	},

	effective(userBitfield: number, groupBitfield?: number | null): number {
		return userBitfield | (groupBitfield ?? 0);
	},
};
