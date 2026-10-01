import { ACE_PREFIX, PERMISSION_ACE_KEYS } from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';

/** converts the player ace permissions back into a bitfield */
export function getPermissions(source: number): number {
	let permissions: number = 0;

	for (const [rawBit, rawAce] of Object.entries(PERMISSION_ACE_KEYS)) {
		const bit = parseInt(rawBit, 10);
		const ace = `${ACE_PREFIX}.${rawAce}`;

		if (IsPlayerAceAllowed(`${source}`, ace)) permissions |= bit;
	}

	return permissions;
}

/** the bare prefix ace granted to master admins, covers the whole fxmanager.* tree */
export const MASTER_ACE = 'MASTER';

/** converts a bitfield permission to ace keys */
export function permissionsToAceKeys(bitfield: number): string[] {
	if (PermissionManager.isMaster(bitfield)) return [MASTER_ACE];

	return Object.entries(PERMISSION_ACE_KEYS)
		.filter(([rawBit]) => (bitfield & Number(rawBit)) !== 0)
		.map(([, aceKey]) => aceKey);
}

/** checks whether a player is allowed the bare prefix ace (fxmanager master) */
export function hasMasterAce(source: number): boolean {
	return IsPlayerAceAllowed(`${source}`, ACE_PREFIX);
}
