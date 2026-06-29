// region types

export interface TxAdminIdentifier {
	type: string;
	value: string;
}

interface ImportPlayerNote {
	content: string;
	issuedAt: Date;
}

export interface ImportPlayer {
	name: string;
	playtime: number;
	firstSeen: Date;
	lastSeen: Date;
	identifiers: TxAdminIdentifier[];
	note: ImportPlayerNote | null;
}

export interface ImportAction {
	type: 'ban' | 'warn';
	reason: string;
	identifiers: TxAdminIdentifier[];
	playerName: string;
	createdAt: Date;
	expiresAt: Date | null;
	revokedAt: Date | null;
	acked: boolean;
}

interface ImportWhitelist {
	type: string;
	value: string;
	addedAt: Date;
}

export interface TxAdminImport {
	players: ImportPlayer[];
	actions: ImportAction[];
	whitelist: ImportWhitelist[];
}

// region raw input shapes (txAdmin playersDB.json v5)

interface RawTxNote {
	text?: string;
	lastAdmin?: string;
	tsLastEdit?: number;
}

interface RawTxPlayer {
	ids?: string[];
	displayName?: string;
	pureName?: string;
	playTime?: number;
	tsJoined?: number;
	tsLastConnection?: number;
	notes?: RawTxNote;
}

interface RawTxRevocation {
	timestamp?: number | null;
	author?: string | null;
}

interface RawTxAction {
	type?: string;
	ids?: string[];
	playerName?: string;
	reason?: string;
	timestamp?: number;
	expiration?: number | boolean;
	acked?: boolean;
	revocation?: RawTxRevocation;
}

interface RawTxApproval {
	id?: string;
	tsApproved?: number;
	playerName?: string;
	approvedBy?: string;
}

// region helpers

const secondsToDate = (seconds: number | undefined | null): Date =>
	new Date((seconds ?? 0) * 1000);

// region transformers

export function parseIdentifiers(ids: string[]): TxAdminIdentifier[] {
	if (!Array.isArray(ids)) return [];

	const seen = new Set<string>();
	const result: TxAdminIdentifier[] = [];

	for (const entry of ids) {
		if (typeof entry !== 'string') continue;

		const colon = entry.indexOf(':');
		if (colon <= 0) continue;

		const type = entry.slice(0, colon);
		if (!entry.slice(colon + 1)) continue;

		if (seen.has(entry)) continue;

		seen.add(entry);
		result.push({ type, value: entry });
	}

	return result;
}

export function transformPlayer(raw: RawTxPlayer): ImportPlayer {
	const name = raw.displayName?.trim() || raw.pureName?.trim() || 'Unknown';

	const noteText = raw.notes?.text?.trim();
	const note: ImportPlayerNote | null = noteText
		? { content: noteText, issuedAt: secondsToDate(raw.notes?.tsLastEdit) }
		: null;

	return {
		name,
		playtime: (raw.playTime ?? 0) * 60 * 1000,
		firstSeen: secondsToDate(raw.tsJoined),
		lastSeen: secondsToDate(raw.tsLastConnection),
		identifiers: parseIdentifiers(raw.ids as string[]),
		note,
	};
}

export function transformAction(raw: RawTxAction): ImportAction {
	const type: 'ban' | 'warn' = raw.type === 'warn' ? 'warn' : 'ban';

	return {
		type,
		reason: raw.reason?.trim() || 'No reason provided',
		identifiers: parseIdentifiers(raw.ids as string[]),
		playerName: raw.playerName?.trim() || 'Unknown',
		createdAt: secondsToDate(raw.timestamp),
		expiresAt:
			typeof raw.expiration === 'number' ? secondsToDate(raw.expiration) : null,
		revokedAt: raw.revocation?.timestamp
			? secondsToDate(raw.revocation.timestamp)
			: null,
		acked: raw.acked === true,
	};
}

export function transformWhitelistApproval(
	raw: RawTxApproval,
): ImportWhitelist | null {
	const [identifier] = parseIdentifiers([raw.id as string]);
	if (!identifier) return null;

	return {
		type: identifier.type,
		value: identifier.value,
		addedAt: secondsToDate(raw.tsApproved),
	};
}

export function parseTxAdminDb(raw: unknown): TxAdminImport {
	if (!raw || typeof raw !== 'object') {
		throw new Error('invalid_txadmin_db');
	}

	const db = raw as {
		players?: unknown;
		actions?: unknown;
		whitelistApprovals?: unknown;
	};

	if (!Array.isArray(db.players) || !Array.isArray(db.actions)) {
		throw new Error('invalid_txadmin_db');
	}

	const approvals = Array.isArray(db.whitelistApprovals)
		? db.whitelistApprovals
		: [];

	return {
		players: db.players.map(transformPlayer),
		actions: db.actions.map(transformAction),
		whitelist: approvals
			.map(transformWhitelistApproval)
			.filter((entry): entry is ImportWhitelist => entry !== null),
	};
}
