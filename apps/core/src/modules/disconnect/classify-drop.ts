/**
 * Drop-reason classification adapted from txAdmin
 * (core/modules/Metrics/playerDrop/classifyDropReason.ts).
 * Original work Copyright (c) 2019-2025 Take-Two Interactive Software, Inc. — MIT License.
 * https://github.com/citizenfx/txAdmin
 *
 * Collapsed to fxManager's 5 buckets. Unlike txAdmin, SERVER-initiated drops
 * map to `kick` (not `security`) to match the panel's "Kicks/Bans" bucket.
 */
import type { DropCategory } from '@fxmanager/shared/types';

// From fivem/code/components/citizen-server-impl/include/ClientDropReasons.h
enum FxsDropReasonGroups {
	RESOURCE = 1,
	CLIENT = 2,
	SERVER = 3,
	CLIENT_REPLACED = 4,
	CLIENT_CONNECTION_TIMED_OUT = 5,
	CLIENT_CONNECTION_TIMED_OUT_WITH_PENDING_COMMANDS = 6,
	SERVER_SHUTDOWN = 7,
	STATE_BAG_RATE_LIMIT = 8,
	NET_EVENT_RATE_LIMIT = 9,
	LATENT_NET_EVENT_RATE_LIMIT = 10,
	COMMAND_RATE_LIMIT = 11,
	ONE_SYNC_TOO_MANY_MISSED_FRAMES = 12,
}

const timeoutCategories = new Set<number>([
	FxsDropReasonGroups.CLIENT_CONNECTION_TIMED_OUT,
	FxsDropReasonGroups.CLIENT_CONNECTION_TIMED_OUT_WITH_PENDING_COMMANDS,
	FxsDropReasonGroups.ONE_SYNC_TOO_MANY_MISSED_FRAMES,
]);

// Crash message prefixes are translated client-side; cover the top FiveM languages.
const crashRulesIntl = [
	`game crashed: `,
	`o jogo crashou: `,
	`le jeu a cessé de fonctionner : `,
	`spielabsturz: `,
	`el juego crasheó: `,
	`تعطلت العبة: `,
	`spel werkt niet meer: `,
	`oyun çöktü: `,
	`a játék összeomlott: `,
	`il gioco ha smesso di funzionare: `,
	`游戏发生崩溃：`,
	`遊戲已崩潰: `,
	`pád hry: `,
	`spelet kraschade: `,
];

const playerInitiatedRules = [
	`exiting`,
	`disconnected.`,
	`connecting to another server`,
	`could not find requested level`,
	`entering rockstar editor`,
	`quit:`,
	`reconnecting`,
	`reloading game`,
];
const serverShutdownRules = [`server shutting down:`];
const serverKickRules = [`disconnected by server:`, `[txadmin]`, `[fxmanager]`];
const timeoutRules = [
	`server->client connection timed out`,
	`connection timed out`,
	`timed out after 60 seconds`,
];

const isCrash = (reason: string) => crashRulesIntl.some((r) => reason.includes(r));

/** String-only fallback for fxserver builds that don't pass a numeric category. */
function guessFromReason(reason: string): DropCategory | null {
	const r = reason.trim().toLowerCase();
	if (!r.length) return 'other';
	if (isCrash(r)) return 'crash';
	if (playerInitiatedRules.some((rule) => r.startsWith(rule))) return 'quit';
	if (timeoutRules.some((rule) => r.includes(rule))) return 'timeout';
	if (serverShutdownRules.some((rule) => r.startsWith(rule))) return null;
	if (serverKickRules.some((rule) => r.startsWith(rule))) return 'kick';
	return 'other';
}

/**
 * Classify a drop into one of the 5 buckets, or `null` when it should be
 * ignored (server shutdown / restart mass-drop).
 */
export function classifyDrop(payload: {
	reason: unknown;
	category?: number;
}): DropCategory | null {
	const reason = typeof payload.reason === 'string' ? payload.reason : '';

	if (typeof payload.category !== 'number' || payload.category <= 0) {
		return guessFromReason(reason);
	}

	const category = payload.category;
	if (category === FxsDropReasonGroups.RESOURCE) {
		if (reason === 'server_shutting_down') return null;
		return 'kick';
	}
	if (category === FxsDropReasonGroups.CLIENT) {
		return isCrash(reason.toLowerCase()) ? 'crash' : 'quit';
	}
	if (category === FxsDropReasonGroups.SERVER) return 'kick';
	if (category === FxsDropReasonGroups.SERVER_SHUTDOWN) return null;
	if (timeoutCategories.has(category)) return 'timeout';
	return 'other';
}
