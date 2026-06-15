import { describe, expect, it } from 'bun:test';
import {
	parseIdentifiers,
	parseTxAdminDb,
	transformAction,
	transformPlayer,
	transformWhitelistApproval,
} from './txadmin';

describe('parseIdentifiers', () => {
	it('splits each "type:value" entry on the first colon', () => {
		const result = parseIdentifiers([
			'steam:1100001721ad022',
			'license:64c013bfdecf4e66',
			'discord:1216687964227112963',
		]);

		expect(result).toEqual([
			{ type: 'steam', value: 'steam:1100001721ad022' },
			{ type: 'license', value: 'license:64c013bfdecf4e66' },
			{ type: 'discord', value: 'discord:1216687964227112963' },
		]);
	});

	it('keeps license2 as a distinct identifier type', () => {
		const result = parseIdentifiers([
			'license:abc',
			'license2:def',
		]);

		expect(result).toContainEqual({ type: 'license', value: 'license:abc' });
		expect(result).toContainEqual({ type: 'license2', value: 'license2:def' });
	});

	it('skips malformed entries with no colon or empty value', () => {
		const result = parseIdentifiers([
			'garbage',
			'license:',
			'',
			'steam:valid',
		]);

		expect(result).toEqual([{ type: 'steam', value: 'steam:valid' }]);
	});

	it('dedupes identical identifiers', () => {
		const result = parseIdentifiers([
			'license:abc',
			'license:abc',
		]);

		expect(result).toEqual([{ type: 'license', value: 'license:abc' }]);
	});

	it('returns an empty array for non-array input', () => {
		expect(parseIdentifiers(undefined as unknown as string[])).toEqual([]);
	});
});

describe('transformPlayer', () => {
	const raw = {
		license: '8676b3a35bb772bd7de43df21079f3603ed3516d',
		ids: [
			'steam:11000012ee73e38',
			'license:8676b3a35bb772bd7de43df21079f3603ed3516d',
			'discord:481267231393841153',
		],
		hwids: ['3:abc'],
		displayName: 'CaliChris',
		pureName: 'calichris',
		playTime: 24088,
		tsLastConnection: 1781156576,
		tsJoined: 1775845668,
		notes: {
			text: 'FRP 1st offense',
			lastAdmin: 'Meli',
			tsLastEdit: 1779553664,
		},
	};

	it('uses displayName as the player name', () => {
		expect(transformPlayer(raw).name).toBe('CaliChris');
	});

	it('converts playTime from minutes to milliseconds', () => {
		expect(transformPlayer(raw).playtime).toBe(24088 * 60 * 1000);
	});

	it('converts tsJoined and tsLastConnection from unix seconds to Date', () => {
		const player = transformPlayer(raw);
		expect(player.firstSeen).toEqual(new Date(1775845668 * 1000));
		expect(player.lastSeen).toEqual(new Date(1781156576 * 1000));
	});

	it('parses identifiers from the ids array', () => {
		expect(transformPlayer(raw).identifiers).toContainEqual({
			type: 'discord',
			value: 'discord:481267231393841153',
		});
	});

	it('maps notes.text to a note dated at tsLastEdit', () => {
		const note = transformPlayer(raw).note;
		expect(note?.content).toBe('FRP 1st offense');
		expect(note?.issuedAt).toEqual(new Date(1779553664 * 1000));
	});

	it('returns a null note when the player has no notes', () => {
		expect(transformPlayer({ ...raw, notes: undefined }).note).toBeNull();
	});

	it('returns a null note when the note text is empty', () => {
		expect(
			transformPlayer({ ...raw, notes: { text: '   ' } }).note,
		).toBeNull();
	});

	it('falls back to pureName then "Unknown" when displayName is missing', () => {
		expect(transformPlayer({ ...raw, displayName: '' }).name).toBe('calichris');
		expect(
			transformPlayer({ ...raw, displayName: '', pureName: '' }).name,
		).toBe('Unknown');
	});
});

describe('transformAction (ban)', () => {
	const ban = {
		id: 'BTQE-KAEW',
		type: 'ban',
		ids: ['license:64c013bf', 'discord:121668796'],
		hwids: ['4:abc'],
		playerName: 'rdool1',
		reason: 'Cheating/ESP',
		author: 'ethan',
		timestamp: 1775855632,
		expiration: false,
		revocation: { timestamp: null, author: null },
	};

	it('marks the action type as ban', () => {
		expect(transformAction(ban).type).toBe('ban');
	});

	it('maps timestamp to createdAt', () => {
		expect(transformAction(ban).createdAt).toEqual(new Date(1775855632 * 1000));
	});

	it('treats expiration:false as a permanent ban (null expiresAt)', () => {
		expect(transformAction(ban).expiresAt).toBeNull();
	});

	it('converts a numeric expiration to a Date', () => {
		expect(transformAction({ ...ban, expiration: 1800000000 }).expiresAt).toEqual(
			new Date(1800000000 * 1000),
		);
	});

	it('leaves revokedAt null when not revoked', () => {
		expect(transformAction(ban).revokedAt).toBeNull();
	});

	it('maps a revocation timestamp to revokedAt', () => {
		const revoked = transformAction({
			...ban,
			revocation: { timestamp: 1777152610, author: 'izzykitty' },
		});
		expect(revoked.revokedAt).toEqual(new Date(1777152610 * 1000));
	});

	it('preserves the reason and player name', () => {
		const result = transformAction(ban);
		expect(result.reason).toBe('Cheating/ESP');
		expect(result.playerName).toBe('rdool1');
	});

	it('falls back to a placeholder reason when missing', () => {
		expect(transformAction({ ...ban, reason: '' }).reason).toBe(
			'No reason provided',
		);
	});

	it('parses identifiers used to match or create the player', () => {
		expect(transformAction(ban).identifiers).toContainEqual({
			type: 'license',
			value: 'license:64c013bf',
		});
	});
});

describe('transformAction (warn)', () => {
	const warn = {
		id: 'WZYH-T3W5',
		type: 'warn',
		ids: ['license:059dff28', 'discord:147356975'],
		hwids: [],
		playerName: 'BoldBat8059',
		reason: 'Change your outfit',
		author: 'iceagent',
		timestamp: 1775873614,
		expiration: false,
		acked: true,
		revocation: { timestamp: null, author: null },
	};

	it('marks the action type as warn', () => {
		expect(transformAction(warn).type).toBe('warn');
	});

	it('reflects the acked flag', () => {
		expect(transformAction(warn).acked).toBe(true);
		expect(transformAction({ ...warn, acked: false }).acked).toBe(false);
	});

	it('defaults acked to false when the flag is absent', () => {
		expect(transformAction({ ...warn, acked: undefined }).acked).toBe(false);
	});
});

describe('transformWhitelistApproval', () => {
	it('parses the identifier string into a typed whitelist entry', () => {
		const result = transformWhitelistApproval({
			id: 'license:abc123',
			playerName: 'Someone',
			tsApproved: 1775855632,
			approvedBy: 'admin',
		});

		expect(result).toEqual({
			type: 'license',
			value: 'license:abc123',
			addedAt: new Date(1775855632 * 1000),
		});
	});

	it('returns null for an unparseable identifier', () => {
		expect(
			transformWhitelistApproval({ id: 'garbage', tsApproved: 1 }),
		).toBeNull();
	});
});

describe('parseTxAdminDb', () => {
	const db = {
		version: 5,
		players: [
			{
				license: 'abc',
				ids: ['license:abc'],
				displayName: 'P1',
				playTime: 10,
				tsJoined: 1775845668,
				tsLastConnection: 1781156576,
			},
		],
		actions: [
			{
				id: 'X',
				type: 'ban',
				ids: ['license:abc'],
				playerName: 'P1',
				reason: 'r',
				author: 'a',
				timestamp: 1775855632,
				expiration: false,
				revocation: { timestamp: null, author: null },
			},
		],
		whitelistApprovals: [
			{ id: 'discord:999', tsApproved: 1775855632, approvedBy: 'a' },
		],
		whitelistRequests: [],
	};

	it('returns normalized players, actions and whitelist arrays', () => {
		const result = parseTxAdminDb(db);
		expect(result.players).toHaveLength(1);
		expect(result.actions).toHaveLength(1);
		expect(result.whitelist).toHaveLength(1);
		expect(result.players[0].name).toBe('P1');
		expect(result.whitelist[0]).toEqual({
			type: 'discord',
			value: 'discord:999',
			addedAt: new Date(1775855632 * 1000),
		});
	});

	it('tolerates missing whitelist arrays', () => {
		const result = parseTxAdminDb({ ...db, whitelistApprovals: undefined });
		expect(result.whitelist).toEqual([]);
	});

	it('skips unparseable whitelist approvals', () => {
		const result = parseTxAdminDb({
			...db,
			whitelistApprovals: [{ id: 'garbage', tsApproved: 1 }],
		});
		expect(result.whitelist).toEqual([]);
	});

	it('throws when given a non-object', () => {
		expect(() => parseTxAdminDb(null)).toThrow('invalid_txadmin_db');
		expect(() => parseTxAdminDb('nope')).toThrow('invalid_txadmin_db');
	});

	it('throws when players is not an array', () => {
		expect(() => parseTxAdminDb({ version: 5, actions: [] })).toThrow(
			'invalid_txadmin_db',
		);
	});

	it('throws when actions is not an array', () => {
		expect(() => parseTxAdminDb({ version: 5, players: [] })).toThrow(
			'invalid_txadmin_db',
		);
	});
});
