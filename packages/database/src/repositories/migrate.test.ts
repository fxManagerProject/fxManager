import { describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '../schema';
import { migrations, runMigrations } from '../migrations';
import { createMigrateRepository } from './migrate';

type DB = BunSQLiteDatabase<typeof schema>;

function freshDb(): DB {
	const sqlite = new Database(':memory:');
	sqlite.run('PRAGMA foreign_keys = ON;');
	const log = console.log;
	console.log = () => {};
	runMigrations(sqlite, migrations);
	console.log = log;
	return drizzle(sqlite, { schema });
}

const rawDb = {
	version: 5,
	players: [
		{
			license: 'abc',
			ids: ['license:abc', 'discord:123'],
			displayName: 'Player One',
			playTime: 10,
			tsJoined: 1775845668,
			tsLastConnection: 1781156576,
			notes: { text: 'a note', tsLastEdit: 1779553664 },
		},
	],
	actions: [
		{
			id: 'BAN1',
			type: 'ban',
			ids: ['license:orphan'],
			playerName: 'OnSight',
			reason: 'cheating',
			author: 'admin',
			timestamp: 1775855632,
			expiration: false,
			revocation: { timestamp: null, author: null },
		},
	],
	whitelistApprovals: [
		{ id: 'discord:999', tsApproved: 1775855632, approvedBy: 'admin' },
	],
	whitelistRequests: [],
};

describe('repo.migrate.fromTxAdmin', () => {
	it('parses raw txAdmin json, imports it, and returns a summary', () => {
		const db = freshDb();
		const repo = createMigrateRepository(db);

		const summary = repo.fromTxAdmin(rawDb);

		expect(summary.players.created).toBe(1);
		expect(summary.stubPlayers).toBe(1);
		expect(summary.bans.created).toBe(1);
		expect(summary.notes.created).toBe(1);
		expect(summary.whitelist.created).toBe(1);

		expect(db.select().from(schema.players).all()).toHaveLength(2);
		expect(db.select().from(schema.bans).all()).toHaveLength(1);
		expect(db.select().from(schema.whitelistedIdentifers).all()).toHaveLength(1);

		const storedIds = db
			.select()
			.from(schema.playerIdentifiers)
			.all()
			.map((i) => i.value);
		expect(storedIds).toContain('license:abc');
		expect(storedIds).toContain('discord:123');
		expect(storedIds).toContain('license:orphan');

		const wl = db.select().from(schema.whitelistedIdentifers).all();
		expect(wl[0].value).toBe('discord:999');
	});

	it('is idempotent across runs', () => {
		const db = freshDb();
		const repo = createMigrateRepository(db);

		repo.fromTxAdmin(rawDb);
		const second = repo.fromTxAdmin(rawDb);

		expect(second.players.created).toBe(0);
		expect(second.bans.created).toBe(0);
		expect(db.select().from(schema.players).all()).toHaveLength(2);
	});

	it('throws invalid_txadmin_db for malformed input', () => {
		const repo = createMigrateRepository(freshDb());
		expect(() => repo.fromTxAdmin(null)).toThrow('invalid_txadmin_db');
		expect(() => repo.fromTxAdmin({ players: 'nope' })).toThrow(
			'invalid_txadmin_db',
		);
	});
});
