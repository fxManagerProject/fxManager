import { ACE_PREFIX, PERMISSION_ACE_KEYS } from '@fxmanager/shared/constants';

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
