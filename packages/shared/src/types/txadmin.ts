// txAdmin compatibility events. Names and payload field names mirror txAdmin's
// public event API (https://github.com/citizenfx/txAdmin, docs/events.md)

export const TX_EVENT_PREFIX = 'txAdmin:events:';

export const TX_EVENT_NAMES = [
	// server
	'announcement',
	'serverShuttingDown',
	'scheduledRestart',
	'scheduledRestartSkipped',
	// player
	'playerBanned',
	'playerDirectMessage',
	'playerHealed',
	'playerKicked',
	'playerWarned',
	// whitelist
	'whitelistPlayer',
	'whitelistPreApproval',
	'whitelistRequest',
	// other
	'actionRevoked',
	'adminAuth',
	'adminsUpdated',
	'configChanged',
	'consoleCommand',
] as const;

export type TxEventName = (typeof TX_EVENT_NAMES)[number];

export interface TxEventPayloads {
	announcement: { author: string; message: string };
	serverShuttingDown: { delay: number; author: string; message: string };
	scheduledRestart: { secondsRemaining: number; translatedMessage: string };
	scheduledRestartSkipped: {
		secondsRemaining: number;
		temporary: boolean;
		author: string;
	};

	playerBanned: {
		author: string;
		reason: string;
		actionId: string;
		expiration: number | false;
		durationInput: string;
		durationTranslated: string | null;
		targetNetId: number | null;
		targetIds: string[];
		targetHwids: string[];
		targetName: string;
		kickMessage: string;
	};
	playerDirectMessage: { target: number; author: string; message: string };
	playerHealed: { target: number; author: string };
	playerKicked: {
		target: number;
		author: string;
		reason: string;
		dropMessage: string;
	};
	playerWarned: {
		author: string;
		reason: string;
		actionId: string;
		targetNetId: number | null;
		targetIds: string[];
		targetName: string;
	};

	whitelistPlayer: {
		action: 'added' | 'removed';
		license: string;
		playerName: string;
		adminName: string;
	};
	whitelistPreApproval: {
		action: 'added' | 'removed';
		identifier: string;
		playerName?: string;
		adminName: string;
	};
	whitelistRequest: {
		action: 'requested' | 'approved' | 'denied' | 'deniedAll';
		playerName?: string;
		requestId?: string;
		license?: string;
		adminName?: string;
	};

	actionRevoked: {
		actionId: string;
		actionType: string;
		actionReason: string;
		actionAuthor: string;
		playerName: string | false;
		playerIds: string[];
		playerHwids: string[];
		revokedBy: string;
	};
	adminAuth: { netid: number; isAdmin: boolean; username?: string };
	adminsUpdated: number[];
	configChanged: undefined;
	consoleCommand: { author: string; channel: string; command: string };
}

export type TxEventEnvelope<E extends TxEventName = TxEventName> = {
	event: E;
	data: TxEventPayloads[E];
};
