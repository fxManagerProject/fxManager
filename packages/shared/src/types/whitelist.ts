/** Details:
 * * 'identifier'   - any identifier logged in the "whitelisted_identifiers" table
 * * 'discord'      - discord role check
 * * 'admin-only'   - only admins with a linked player can connect
 * * 'none'         - no whitelisting
 */
export type WhitelistMode = 'none' | 'identifier' | 'discord' | 'admin-only';

export type WhitelistEntry = {
	id: number;
	type: string;
	value: string;
	addedAt: Date;
	addedByAdmin?: string;
	playerName?: string;
};
