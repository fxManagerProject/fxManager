export interface PlayerIdentifiers {
	license: string;
	fivem?: string;
	discord?: string;
	steam?: string;
}

export interface Player {
	id: number;
	name: string;
	playtime: number;
	identifiers: PlayerIdentifiers;
	isStaff: boolean;
	firstSeen: Date;
	lastSeen: Date;
}

// region player actions
// body type for http requests

export interface WarnForm {
	reason: string;
}

export interface KickForm {
	reason: string;
}

export interface BanForm {
	reason: string;
	duration: string;
	unit: 'hours' | 'days' | 'weeks' | 'permanent';
}

export interface NoteForm {
	content: string;
}

export type RevokeActionType = 'ban' | 'kick' | 'warn';

export interface PlayerSession {
	id: number;
	connectedAt: number;
	disconnectedAt: number | null;
	durationMs: number | null;
	endReason: string | null;
}

export interface PlayerActivityDay {
	date: string; // YYYY-MM-DD, server-local
	playtimeMs: number;
	sessionCount: number;
}

export interface PlayerActivitySummary {
	daysActive: number;
	totalPlaytimeMs: number;
	longestSessionMs: number;
	avgSessionMs: number;
}

export interface PlayerActivity {
	from: string; // YYYY-MM-DD
	to: string; // YYYY-MM-DD
	days: PlayerActivityDay[];
	summary: PlayerActivitySummary;
}
