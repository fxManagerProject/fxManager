import type { ConvarDef } from '../types/convars';

/**
 * Allowlist / server-appearance convars
 * Reference: https://github.com/citizenfx/txAdmin/commit/bdb55a9042c1af1902c86f972ef2d6dcd3c66190
 */
export const ALLOWLIST_CONVARS: ConvarDef[] = [
	{
		name: 'sv_appearAllowlisted',
		setter: 'sets',
		label: 'Appear allowlisted',
		description:
			'Makes the server appear as allowlisted: the server list shows a lock icon next to the name, and players can see the allowlist instructions on the server page. Enable this when you run any allowlist so players know they cannot join freely.',
		recommended: 'true',
		control: { kind: 'boolean' },
	},
	{
		name: 'sv_allowlistInstructions',
		setter: 'sets',
		label: 'Allowlist instructions',
		description:
			'Instructions shown to players on the in-game server page and sent to them when they try to connect while not allowlisted. Explain how to apply (e.g. joining a Discord and requesting access). Requires "Appear allowlisted" to be enabled.',
		note: 'Maximum 512 characters. Line breaks are supported.',
		control: {
			kind: 'text',
			maxLength: 512,
			multiline: true,
			placeholder:
				'Please join http://discord.gg/example and request to be allowlisted.',
		},
	},
];
