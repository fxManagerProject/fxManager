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
