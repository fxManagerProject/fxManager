import type { AnticheatConvarDef } from '../types/convars';

const BOOLEAN_OPTIONS = { kind: 'boolean' } as const;

/**
 * Curated set of anticheat / hardening convars surfaced in the Anticheat tab.
 * Descriptions follow the official FiveM server-commands documentation:
 * https://docs.fivem.net/docs/server-manual/server-commands/
 *
 * Values are stored per-convar only when the user explicitly sets one, so
 * nothing here is injected into the server unless enabled — the user's own
 * server.cfg is never overridden by default.
 */
export const ANTICHEAT_CONVARS: AnticheatConvarDef[] = [
	{
		name: 'sv_endpointPrivacy',
		setter: 'set',
		label: 'Endpoint privacy',
		description:
			'If true, hides player IP addresses from the public reports the server outputs, so they cannot be harvested for DDoS attacks.',
		recommended: 'true',
		control: BOOLEAN_OPTIONS,
	},
	{
		name: 'sv_scriptHookAllowed',
		setter: 'set',
		label: 'Allow ScriptHook',
		description:
			'Whether ScriptHookV may be used on the server (1 = allowed, 0 = disallowed). Disallowing it blocks most single-player mod menus and trainers.',
		recommended: '0',
		control: {
			kind: 'enum',
			options: [
				{ value: '0', label: '0 – Disallowed' },
				{ value: '1', label: '1 – Allowed' },
			],
		},
	},
	{
		name: 'sv_requestParanoia',
		setter: 'set',
		label: 'Request paranoia',
		description:
			'Helps counter proxy-based HTTP floods by blocking suspicious request patterns. 0 = off; 1 = block IPs sending a "Via" header; 2 = also block IPs sending an "Upgrade-Insecure-Requests" header; 3 = additionally close the socket for blocked requests.',
		recommended: '3',
		control: {
			kind: 'enum',
			options: [
				{ value: '0', label: '0 – Off' },
				{ value: '1', label: '1 – Block "Via" header' },
				{ value: '2', label: '2 – + "Upgrade-Insecure-Requests"' },
				{ value: '3', label: '3 – + close socket' },
			],
		},
	},
	{
		name: 'sv_enableNetworkedPhoneExplosions',
		setter: 'set',
		label: 'Networked phone explosions',
		description:
			'Whether clients may route REQUEST_PHONE_EXPLOSION_EVENT through the server. Disabled by default; leaving it disabled stops cheaters triggering networked phone explosions.',
		recommended: 'false',
		control: BOOLEAN_OPTIONS,
	},
	{
		name: 'sv_filterRequestControl',
		setter: 'set',
		label: 'Filter request control',
		description:
			"Controls REQUEST_CONTROL_EVENT routing so clients cannot forcibly take control of entities (a common griefing/crash vector). 0 = off; 1 = block control of settled player entities (older than the settle timer); 2 = block all player-entity control; 3 = block players plus settled non-player entities; 4 = never route control events.",
		note: 'Levels 1 and 3 use the settle timer below. Some entity-carrying scripts may need a lower level.',
		recommended: '4',
		control: {
			kind: 'enum',
			options: [
				{ value: '0', label: '0 – Off' },
				{ value: '1', label: '1 – Settled player entities' },
				{ value: '2', label: '2 – All player entities' },
				{ value: '3', label: '3 – Players + settled non-players' },
				{ value: '4', label: '4 – All control requests' },
			],
		},
	},
	{
		name: 'sv_filterRequestControlSettleTimer',
		setter: 'set',
		label: 'Request-control settle timer',
		description:
			'How long after an entity is created (in milliseconds) before it is considered "settled" and blocked from REQUEST_CONTROL_EVENT. Used by Filter request control levels 1 and 3. Default is 30000 (30 seconds).',
		recommended: '30000',
		control: { kind: 'number', min: 0, unit: 'ms' },
	},
	{
		name: 'sv_enableNetworkedSounds',
		setter: 'set',
		label: 'Networked sounds',
		description:
			'Whether clients may route NETWORK_PLAY_SOUND_EVENT through the server. Enabled by default and commonly abused by malicious actors; set to Disabled to block networked sounds.',
		recommended: 'false',
		control: BOOLEAN_OPTIONS,
	},
	{
		name: 'sv_enableNetworkedScriptEntityStates',
		setter: 'set',
		label: 'Networked script entity states',
		description:
			'Whether clients may route SCRIPT_ENTITY_STATE_CHANGE_EVENT through the server. Enabled by default and commonly abused by malicious actors; set to Disabled to block it.',
		recommended: 'false',
		control: BOOLEAN_OPTIONS,
	},
	{
		name: 'sv_protectServerEntities',
		setter: 'set',
		label: 'Protect server entities',
		description:
			'Prevents clients from deleting entities that were created by the server, stopping entity-deletion griefing.',
		recommended: 'true',
		control: BOOLEAN_OPTIONS,
	},
	{
		name: 'game_sanitizeRagdollEvents',
		setter: 'setr',
		label: 'Sanitize ragdoll events',
		description:
			"Prevents 'force ragdoll' cheats where a client forces other players into a ragdoll state.",
		recommended: 'true',
		control: BOOLEAN_OPTIONS,
	},
	{
		name: 'game_sanitizePlayerAttachment',
		setter: 'setr',
		label: 'Sanitize player attachment',
		description:
			'Prevents vehicles and objects from being attached to players (an attachment-based griefing / crash cheat). Higher values sanitise more; the reference config uses 2.',
		recommended: '2',
		control: {
			kind: 'enum',
			options: [
				{ value: '0', label: '0 – Off' },
				{ value: '1', label: '1' },
				{ value: '2', label: '2' },
			],
		},
	},
	{
		name: 'game_enableVehicleHijackFix',
		setter: 'setr',
		label: 'Vehicle hijack fix',
		description: 'Prevents vehicle-hijack cheats.',
		note: 'Also disables pressing F on the driver door to pull someone out and steal a car.',
		recommended: 'true',
		control: BOOLEAN_OPTIONS,
	},
	{
		name: 'sv_stateBagStrictMode',
		setter: 'setr',
		label: 'State bag strict mode',
		description:
			'Determines whether clients are allowed to set replicated state bags.',
		recommended: 'true',
		control: BOOLEAN_OPTIONS,
	},
];
