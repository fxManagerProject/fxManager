/**
 * Disconnect categories adapted from txAdmin
 * (core/modules/Metrics/playerDrop + panel/src/lib/playerDropCategories.ts).
 * Original work Copyright (c) 2019-2025 Take-Two Interactive Software, Inc. — MIT License.
 * https://github.com/citizenfx/txAdmin
 */

export type DropCategory = 'quit' | 'crash' | 'timeout' | 'kick' | 'other';

/** Per-category disconnect tallies (a session total or a time-range slice). */
export type DisconnectCounts = Record<DropCategory, number>;

export const zeroDisconnectCounts = (): DisconnectCounts => ({
	quit: 0,
	crash: 0,
	timeout: 0,
	kick: 0,
	other: 0,
});

/** One server run's disconnect tallies. Timestamps are epoch ms. */
export interface DisconnectSession extends DisconnectCounts {
	id: number;
	startedAt: number;
	endedAt: number | null;
}

export interface DisconnectCategoryMeta {
	key: DropCategory;
	label: string;
	color: string;
	description: string;
}

export const DISCONNECT_CATEGORIES: readonly DisconnectCategoryMeta[] = [
	{
		key: 'quit',
		label: 'Quit',
		color: '#39E673',
		description: 'Player quit the game or left the server normally.',
	},
	{
		key: 'crash',
		label: 'Crash',
		color: '#FF913F',
		description: 'Player left due to a game crash that reported its reason.',
	},
	{
		key: 'timeout',
		label: 'Timeout',
		color: '#F0E38B',
		description:
			'Connection timed out — networking issues or a silent client crash.',
	},
	{
		key: 'kick',
		label: 'Kick/Ban',
		color: '#406FE6',
		description: 'Player was kicked or banned by staff or a resource.',
	},
	{
		key: 'other',
		label: 'Other',
		color: '#F13BF7',
		description: 'Security kicks, replaced sessions, or unknown reasons.',
	},
] as const;
