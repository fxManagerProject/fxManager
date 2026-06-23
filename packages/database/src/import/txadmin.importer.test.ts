import { beforeEach, describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import { migrations, runMigrations } from '../migrations';
import { importTxAdmin } from './txadmin.importer';
import type { TxAdminImport } from './txadmin';

type DB = BunSQLiteDatabase<typeof schema>;

function freshDb(): DB {
	const sqlite = new Database(':memory:');
	sqlite.run('PRAGMA foreign_keys = ON;');

	// migrations log to console; silence to keep test output pristine
	const log = console.log;
	console.log = () => {};
	runMigrations(sqlite, migrations);
	console.log = log;

	return drizzle(sqlite, { schema });
}

function emptyImport(): TxAdminImport {
	return { players: [], actions: [], whitelist: [] };
}

let db: DB;
beforeEach(() => {
	db = freshDb();
});

describe('importTxAdmin - players', () => {
	const data: TxAdminImport = {
		...emptyImport(),
		players: [
			{
				name: 'CaliChris',
				playtime: 1_440_000,
				firstSeen: new Date(1775845668 * 1000),
				lastSeen: new Date(1781156576 * 1000),
				identifiers: [
					{ type: 'license', value: 'abc' },
					{ type: 'discord', value: '123' },
				],
				note: { content: 'a note', issuedAt: new Date(1779553664 * 1000) },
			},
		],
	};

	it('inserts a new player with all identifiers', () => {
		importTxAdmin(db, data);

		const players = db.select().from(schema.players).all();
		expect(players).toHaveLength(1);
		expect(players[0].name).toBe('CaliChris');
		expect(players[0].playtime).toBe(1_440_000);

		const ids = db.select().from(schema.playerIdentifiers).all();
		expect(ids.map((i) => i.value).sort()).toEqual(['123', 'abc']);
	});

	it('imports the player note attached to the player', () => {
		importTxAdmin(db, data);

		const notes = db.select().from(schema.playerNotes).all();
		expect(notes).toHaveLength(1);
		expect(notes[0].content).toBe('a note');
		expect(notes[0].issuer).toBeNull();
	});

	it('is idempotent: re-running creates no duplicate players, ids or notes', () => {
		importTxAdmin(db, data);
		const summary = importTxAdmin(db, data);

		expect(db.select().from(schema.players).all()).toHaveLength(1);
		expect(db.select().from(schema.playerIdentifiers).all()).toHaveLength(2);
		expect(db.select().from(schema.playerNotes).all()).toHaveLength(1);
		expect(summary.players.created).toBe(0);
		expect(summary.players.matched).toBe(1);
	});

	it('reports created counts in the summary', () => {
		const summary = importTxAdmin(db, data);
		expect(summary.players.created).toBe(1);
		expect(summary.identifiers.created).toBe(2);
		expect(summary.notes.created).toBe(1);
	});
});

describe('importTxAdmin - actions matched to existing players', () => {
	const data: TxAdminImport = {
		...emptyImport(),
		players: [
			{
				name: 'P1',
				playtime: 0,
				firstSeen: new Date(1000 * 1000),
				lastSeen: new Date(2000 * 1000),
				identifiers: [{ type: 'license', value: 'abc' }],
				note: null,
			},
		],
		actions: [
			{
				type: 'ban',
				reason: 'Cheating',
				identifiers: [{ type: 'license', value: 'abc' }],
				playerName: 'P1',
				createdAt: new Date(1775855632 * 1000),
				expiresAt: null,
				revokedAt: null,
				acked: false,
			},
		],
	};

	it('attaches the ban to the existing player without creating a stub', () => {
		const summary = importTxAdmin(db, data);

		expect(db.select().from(schema.players).all()).toHaveLength(1);
		expect(summary.stubPlayers).toBe(0);

		const bans = db.select().from(schema.bans).all();
		expect(bans).toHaveLength(1);
		expect(bans[0].playerId).toBe(1);
		expect(bans[0].reason).toBe('Cheating');
		expect(bans[0].issuer).toBeNull();
	});
});

describe('importTxAdmin - orphan actions', () => {
	const data: TxAdminImport = {
		...emptyImport(),
		actions: [
			{
				type: 'ban',
				reason: 'on-sight',
				identifiers: [{ type: 'license', value: 'orphan' }],
				playerName: 'GhostBanned',
				createdAt: new Date(1775855632 * 1000),
				expiresAt: null,
				revokedAt: null,
				acked: false,
			},
		],
	};

	it('creates a stub player from the action and attaches the ban', () => {
		const summary = importTxAdmin(db, data);

		const players = db.select().from(schema.players).all();
		expect(players).toHaveLength(1);
		expect(players[0].name).toBe('GhostBanned');
		expect(summary.stubPlayers).toBe(1);

		const ids = db.select().from(schema.playerIdentifiers).all();
		expect(ids).toHaveLength(1);
		expect(ids[0].value).toBe('orphan');

		const bans = db.select().from(schema.bans).all();
		expect(bans[0].playerId).toBe(players[0].id);
	});

	it('reuses the same stub player for two actions sharing an identifier', () => {
		importTxAdmin(db, {
			...data,
			actions: [
				...data.actions,
				{
					type: 'warn',
					reason: 'second',
					identifiers: [{ type: 'license', value: 'orphan' }],
					playerName: 'GhostBanned',
					createdAt: new Date(1775855700 * 1000),
					expiresAt: null,
					revokedAt: null,
					acked: false,
				},
			],
		});

		expect(db.select().from(schema.players).all()).toHaveLength(1);
		expect(db.select().from(schema.bans).all()).toHaveLength(1);
		expect(db.select().from(schema.warns).all()).toHaveLength(1);
	});
});

describe('importTxAdmin - ban fields', () => {
	function banWith(overrides: Partial<TxAdminImport['actions'][number]>) {
		const localDb = freshDb();
		const data: TxAdminImport = {
			...emptyImport(),
			actions: [
				{
					type: 'ban',
					reason: 'r',
					identifiers: [{ type: 'license', value: 'x' }],
					playerName: 'X',
					createdAt: new Date(1000 * 1000),
					expiresAt: null,
					revokedAt: null,
					acked: false,
					...overrides,
				},
			],
		};
		importTxAdmin(localDb, data);
		return localDb.select().from(schema.bans).all()[0];
	}

	it('stores a permanent ban with null expiresAt', () => {
		expect(banWith({ expiresAt: null }).expiresAt).toBeNull();
	});

	it('stores a temporary ban expiry', () => {
		const expires = new Date(1800000000 * 1000);
		expect(banWith({ expiresAt: expires }).expiresAt).toEqual(expires);
	});

	it('stores the revocation timestamp', () => {
		const revoked = new Date(1777152610 * 1000);
		expect(banWith({ revokedAt: revoked }).revokedAt).toEqual(revoked);
	});
});

describe('importTxAdmin - warn fields', () => {
	function warnWith(overrides: Partial<TxAdminImport['actions'][number]>) {
		const localDb = freshDb();
		const data: TxAdminImport = {
			...emptyImport(),
			actions: [
				{
					type: 'warn',
					reason: 'r',
					identifiers: [{ type: 'license', value: 'x' }],
					playerName: 'X',
					createdAt: new Date(1000 * 1000),
					expiresAt: null,
					revokedAt: null,
					acked: false,
					...overrides,
				},
			],
		};
		importTxAdmin(localDb, data);
		return localDb.select().from(schema.warns).all()[0];
	}

	it('marks an acked warn as read', () => {
		expect(warnWith({ acked: true }).read).toBe(1);
		expect(warnWith({ acked: false }).read).toBe(0);
	});

	it('marks a revoked warn as revoked', () => {
		expect(warnWith({ revokedAt: new Date(2000 * 1000) }).revoked).toBe(1);
		expect(warnWith({ revokedAt: null }).revoked).toBe(0);
	});

	it('uses createdAt as the warn issuedAt', () => {
		expect(warnWith({ createdAt: new Date(1234 * 1000) }).issuedAt).toEqual(
			new Date(1234 * 1000),
		);
	});
});

describe('importTxAdmin - action idempotency', () => {
	const data: TxAdminImport = {
		...emptyImport(),
		actions: [
			{
				type: 'ban',
				reason: 'dupe-check',
				identifiers: [{ type: 'license', value: 'abc' }],
				playerName: 'P',
				createdAt: new Date(1775855632 * 1000),
				expiresAt: null,
				revokedAt: null,
				acked: false,
			},
		],
	};

	it('does not duplicate bans on re-run', () => {
		importTxAdmin(db, data);
		const summary = importTxAdmin(db, data);

		expect(db.select().from(schema.bans).all()).toHaveLength(1);
		expect(summary.bans.created).toBe(0);
		expect(summary.bans.skipped).toBe(1);
	});
});

describe('importTxAdmin - whitelist', () => {
	const data: TxAdminImport = {
		...emptyImport(),
		whitelist: [
			{ type: 'license', value: 'wl1', addedAt: new Date(1000 * 1000) },
			{ type: 'discord', value: 'wl2', addedAt: new Date(2000 * 1000) },
		],
	};

	it('imports whitelist entries as system entries', () => {
		const summary = importTxAdmin(db, data);

		const wl = db.select().from(schema.whitelistedIdentifers).all();
		expect(wl).toHaveLength(2);
		expect(wl.every((w) => w.system === 1)).toBe(true);
		expect(wl.every((w) => w.adminId === null)).toBe(true);
		expect(summary.whitelist.created).toBe(2);
	});

	it('is idempotent for whitelist entries', () => {
		importTxAdmin(db, data);
		const summary = importTxAdmin(db, data);

		expect(db.select().from(schema.whitelistedIdentifers).all()).toHaveLength(
			2,
		);
		expect(summary.whitelist.created).toBe(0);
	});
});

describe('importTxAdmin - shared identifiers across players', () => {
	it('does not crash when two import players share an identifier', () => {
		const data: TxAdminImport = {
			...emptyImport(),
			players: [
				{
					name: 'A',
					playtime: 0,
					firstSeen: new Date(0),
					lastSeen: new Date(0),
					identifiers: [{ type: 'license', value: 'shared' }],
					note: null,
				},
				{
					name: 'B',
					playtime: 0,
					firstSeen: new Date(0),
					lastSeen: new Date(0),
					identifiers: [{ type: 'license', value: 'shared' }],
					note: null,
				},
			],
		};

		expect(() => importTxAdmin(db, data)).not.toThrow();

		const ids = db
			.select()
			.from(schema.playerIdentifiers)
			.where(eq(schema.playerIdentifiers.value, 'shared'))
			.all();
		expect(ids).toHaveLength(1);
	});
});
