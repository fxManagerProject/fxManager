// biome-ignore-all lint/suspicious/noExplicitAny: singleton reset & dynamic types
import { afterAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../schema';
import { migrations, runMigrations } from '../migrations';
import { createEventLogsRepository } from './event-logs';
import type { EventLogInsert } from './event-logs';

// ── Mock event log seed data ────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);

/** Helper to stamp timestamps relative to NOW. */
const ts = (secondsAgo: number) => NOW - secondsAgo;

const SEED_PLAYERS = {
	alice: { id: 1, name: 'Alice' },
	bob: { id: 2, name: 'Bob' },
	charlie: { id: 3, name: 'Charlie' },
	diana: { id: 4, name: 'Diana' },
	eve: { id: 5, name: 'Eve' },
};

const SEED_EVENTS: EventLogInsert[] = [
	// ── Join/leave cycle ─────────────────────────────────────────────────
	{
		event: 'player_joined',
		timestamp: ts(3600),
		playerId: SEED_PLAYERS.alice.id,
		playerName: SEED_PLAYERS.alice.name,
		data: { identifiers: { license: 'license:alice' } },
	},
	{
		event: 'player_joined',
		timestamp: ts(3590),
		playerId: SEED_PLAYERS.bob.id,
		playerName: SEED_PLAYERS.bob.name,
		data: { identifiers: { license: 'license:bob' } },
	},
	{
		event: 'player_joined',
		timestamp: ts(3550),
		playerId: SEED_PLAYERS.charlie.id,
		playerName: SEED_PLAYERS.charlie.name,
		data: { identifiers: { license: 'license:charlie' } },
	},

	// ── Deaths & respawns ────────────────────────────────────────────────
	{
		event: 'player_death',
		timestamp: ts(3500),
		playerId: SEED_PLAYERS.alice.id,
		playerName: SEED_PLAYERS.alice.name,
		data: { killer: 'Bob', weapon: 'WEAPON_PISTOL', cause: 453432689 },
	},
	{
		event: 'player_respawned',
		timestamp: ts(3495),
		playerId: SEED_PLAYERS.alice.id,
		playerName: SEED_PLAYERS.alice.name,
		data: { coords: { x: 215.3, y: -812.1, z: 30.5 } },
	},
	{
		event: 'player_death',
		timestamp: ts(3400),
		playerId: SEED_PLAYERS.bob.id,
		playerName: SEED_PLAYERS.bob.name,
		data: {
			killer: 'Charlie',
			weapon: 'WEAPON_ASSAULTRIFLE',
			cause: 322957350,
		},
	},
	{
		event: 'player_death',
		timestamp: ts(3200),
		playerId: SEED_PLAYERS.charlie.id,
		playerName: SEED_PLAYERS.charlie.name,
		data: { killer: 'Unknown', weapon: 'WEAPON_EXPLOSION', cause: 539292904 },
	},
	{
		event: 'player_respawned',
		timestamp: ts(3195),
		playerId: SEED_PLAYERS.charlie.id,
		playerName: SEED_PLAYERS.charlie.name,
		data: { coords: { x: -542.7, y: -215.3, z: 37.6 } },
	},

	// ── Vehicles ─────────────────────────────────────────────────────────
	{
		event: 'player_entered_vehicle',
		timestamp: ts(3000),
		playerId: SEED_PLAYERS.alice.id,
		playerName: SEED_PLAYERS.alice.name,
		data: { vehicle: 'adder', plate: 'ABC 123', seat: -1 },
	},
	{
		event: 'player_entered_vehicle',
		timestamp: ts(2995),
		playerId: SEED_PLAYERS.bob.id,
		playerName: SEED_PLAYERS.bob.name,
		data: { vehicle: 'adder', plate: 'ABC 123', seat: 0 },
	},
	{
		event: 'player_exited_vehicle',
		timestamp: ts(2800),
		playerId: SEED_PLAYERS.alice.id,
		playerName: SEED_PLAYERS.alice.name,
		data: { vehicle: 'adder', plate: 'ABC 123' },
	},
	{
		event: 'player_entered_vehicle',
		timestamp: ts(2500),
		playerId: SEED_PLAYERS.diana.id,
		playerName: SEED_PLAYERS.diana.name,
		data: { vehicle: 'zentorno', plate: 'FAST 01', seat: -1 },
	},

	// ── Teleports ────────────────────────────────────────────────────────
	{
		event: 'player_teleported',
		timestamp: ts(2300),
		playerId: SEED_PLAYERS.alice.id,
		playerName: SEED_PLAYERS.alice.name,
		data: {
			from: { x: 215.3, y: -812.1, z: 30.5 },
			to: { x: 120.0, y: -1800.0, z: 30.0 },
			reason: 'waypoint',
		},
	},
	{
		event: 'player_teleported',
		timestamp: ts(2200),
		playerId: SEED_PLAYERS.charlie.id,
		playerName: SEED_PLAYERS.charlie.name,
		data: {
			from: { x: -542.7, y: -215.3, z: 37.6 },
			to: { x: 255.0, y: -1200.0, z: 30.0 },
			reason: 'admin',
			adminName: 'StaffDuty',
		},
	},

	// ── Chat ─────────────────────────────────────────────────────────────
	{
		event: 'chat_message',
		timestamp: ts(2000),
		playerId: SEED_PLAYERS.alice.id,
		playerName: SEED_PLAYERS.alice.name,
		data: { message: 'Hey everyone!', channel: 'global' },
	},
	{
		event: 'chat_message',
		timestamp: ts(1995),
		playerId: SEED_PLAYERS.bob.id,
		playerName: SEED_PLAYERS.bob.name,
		data: { message: 'yo alice', channel: 'global' },
	},
	{
		event: 'chat_message',
		timestamp: ts(1990),
		playerId: SEED_PLAYERS.eve.id,
		playerName: SEED_PLAYERS.eve.name,
		data: { message: 'Anyone need a ride?', channel: 'global' },
	},

	// ── Damage / shooting ────────────────────────────────────────────────
	{
		event: 'player_shot',
		timestamp: ts(1800),
		playerId: SEED_PLAYERS.bob.id,
		playerName: SEED_PLAYERS.bob.name,
		data: { weapon: 'WEAPON_PISTOL', targetId: 1, targetName: 'Alice' },
	},
	{
		event: 'player_damaged',
		timestamp: ts(1800),
		playerId: SEED_PLAYERS.alice.id,
		playerName: SEED_PLAYERS.alice.name,
		data: {
			attacker: 'Bob',
			weapon: 'WEAPON_PISTOL',
			damage: 34,
			bone: 'left_arm',
		},
	},

	// ── Resources ────────────────────────────────────────────────────────
	{
		event: 'resource_started',
		timestamp: ts(1500),
		data: { resource: 'es_extended', version: '1.10.0' },
	},
	{
		event: 'resource_started',
		timestamp: ts(1490),
		data: { resource: 'ox_inventory', version: '2.40.0' },
	},
	{
		event: 'resource_stopped',
		timestamp: ts(1000),
		data: { resource: 'old_garage_system', reason: 'replaced' },
	},

	// ── System / misc ────────────────────────────────────────────────────
	{
		event: 'weather_changed',
		timestamp: ts(900),
		data: { from: 'EXTRASUNNY', to: 'THUNDER' },
	},
	{
		event: 'time_changed',
		timestamp: ts(600),
		data: { from: { hour: 14, minute: 0 }, to: { hour: 20, minute: 0 } },
	},
	{
		event: 'player_joined',
		timestamp: ts(500),
		playerId: SEED_PLAYERS.eve.id,
		playerName: SEED_PLAYERS.eve.name,
		data: { identifiers: { license: 'license:eve' } },
	},
	{
		event: 'player_left',
		timestamp: ts(300),
		playerId: SEED_PLAYERS.bob.id,
		playerName: SEED_PLAYERS.bob.name,
		data: { reason: 'Disconnected' },
	},
	{
		event: 'player_left',
		timestamp: ts(120),
		playerId: SEED_PLAYERS.charlie.id,
		playerName: SEED_PLAYERS.charlie.name,
		data: { reason: 'Timed out' },
	},
];

// ── Tests ───────────────────────────────────────────────────────────────────

describe('EventLogsRepository', () => {
	const logSpy = spyOn(console, 'log').mockImplementation(() => {});

	let testSqlite: Database;
	let testDb: ReturnType<typeof drizzle<typeof schema>>;
	let repo: ReturnType<typeof createEventLogsRepository>;

	beforeEach(() => {
		logSpy.mockClear();

		// Reset singleton so each test gets a fresh repository on the new DB
		const zeroState = createEventLogsRepository({} as any);
		(zeroState.constructor as any).instance = undefined;

		testSqlite = new Database(':memory:');
		testSqlite.run('PRAGMA foreign_keys = ON;');
		runMigrations(testSqlite, migrations);

		testDb = drizzle(testSqlite, { schema });
		repo = createEventLogsRepository(testDb);
	});

	afterAll(() => {
		logSpy.mockRestore();
	});

	// ── Seed the dataset once per describe ───────────────────────────────
	const seed = () => {
		repo.insertBatch(SEED_EVENTS);
	};

	describe('insert()', () => {
		it('stores a single event and returns the full entry', () => {
			const entry = repo.insert({
				event: 'player_joined',
				playerId: 42,
				playerName: 'TestPlayer',
				data: { custom: true },
			});

			expect(entry.id).toBeTypeOf('string');
			expect(entry.event).toBe('player_joined');
			expect(entry.playerId).toBe(42);
			expect(entry.playerName).toBe('TestPlayer');
			expect(entry.data).toEqual({ custom: true });
			expect(entry.timestamp).toBeGreaterThan(0);
		});

		it('auto-stamps timestamp when omitted', () => {
			const before = Math.floor(Date.now() / 1000);
			const entry = repo.insert({ event: 'test', data: {} });
			expect(entry.timestamp).toBeGreaterThanOrEqual(before);
		});
	});

	describe('insertBatch()', () => {
		it('inserts all seed events and returns them', () => {
			const entries = repo.insertBatch(SEED_EVENTS);
			expect(entries.length).toBe(SEED_EVENTS.length);
			expect(entries[0].event).toBe(SEED_EVENTS[0].event);
			expect(entries[entries.length - 1].event).toBe(
				SEED_EVENTS[SEED_EVENTS.length - 1].event,
			);
		});

		it('returns an empty array for empty input', () => {
			expect(repo.insertBatch([])).toEqual([]);
		});
	});

	describe('getRecent()', () => {
		beforeEach(() => seed());

		it('returns the most recent N entries in oldest-first order', () => {
			const recent = repo.getRecent(5);
			expect(recent.length).toBe(5);
			// Oldest first
			for (let i = 1; i < recent.length; i++) {
				expect(recent[i].timestamp).toBeGreaterThanOrEqual(
					recent[i - 1].timestamp,
				);
			}
		});

		it('defaults to 500 when no limit is passed', () => {
			const recent = repo.getRecent();
			expect(recent.length).toBe(SEED_EVENTS.length); // all 28 fit within 500
		});

		it('clamps to available entries when limit > total', () => {
			const recent = repo.getRecent(9999);
			expect(recent.length).toBe(SEED_EVENTS.length);
		});
	});

	describe('getSince()', () => {
		beforeEach(() => seed());

		it('returns entries with timestamp >= the given cutoff', () => {
			const cutoff = ts(1000); // events newer than ~1000s ago
			const since = repo.getSince(cutoff, 100);
			expect(since.length).toBeGreaterThan(0);
			for (const e of since) {
				expect(e.timestamp).toBeGreaterThanOrEqual(cutoff);
			}
		});

		it('returns nothing when cutoff is in the future', () => {
			const since = repo.getSince(NOW + 10000, 100);
			expect(since).toEqual([]);
		});
	});

	describe('query() – filtering', () => {
		beforeEach(() => seed());

		it('returns all entries when no filters are applied (paginated)', () => {
			const result = repo.query({ pageSize: 100 });
			expect(result.total).toBe(SEED_EVENTS.length);
			expect(result.items.length).toBe(SEED_EVENTS.length);
			expect(result.page).toBe(1);
			expect(result.pageSize).toBe(100);
		});

		it('paginates correctly', () => {
			const p1 = repo.query({ page: 1, pageSize: 10 });
			const p2 = repo.query({ page: 2, pageSize: 10 });
			expect(p1.items.length).toBe(10);
			expect(p2.items.length).toBe(10);
			expect(p1.total).toBe(SEED_EVENTS.length);
			expect(p2.total).toBe(SEED_EVENTS.length);
			// No overlap
			const ids1 = new Set(p1.items.map((e) => e.id));
			for (const e of p2.items) expect(ids1.has(e.id)).toBeFalse();
		});

		it('filters by event type (partial match)', () => {
			const result = repo.query({ event: 'player_joined' });
			expect(result.total).toBe(4); // alice, bob, charlie, eve
			for (const e of result.items) expect(e.event).toBe('player_joined');
		});

		it('filters by exact event types', () => {
			const result = repo.query({
				eventTypes: ['player_death', 'player_respawned'],
			});
			expect(result.total).toBe(5); // 3 deaths + 2 respawns
			for (const e of result.items) {
				expect(['player_death', 'player_respawned']).toContain(e.event);
			}
		});

		it('filters by player name (partial)', () => {
			const result = repo.query({ player: 'Ali' });
			expect(result.total).toBeGreaterThan(0);
			for (const e of result.items) {
				expect(e.playerName?.toLowerCase()).toContain('ali');
			}
		});

		it('filters by player ID', () => {
			const result = repo.query({ player: '3' });
			expect(result.total).toBeGreaterThan(0);
			for (const e of result.items) {
				expect(e.playerId).toBe(3);
			}
		});

		it('filters by time range [from, to]', () => {
			const result = repo.query({
				from: ts(1100),
				to: ts(200),
			});
			expect(result.total).toBeGreaterThan(0);
			for (const e of result.items) {
				expect(e.timestamp).toBeGreaterThanOrEqual(ts(1100));
				expect(e.timestamp).toBeLessThanOrEqual(ts(200));
			}
		});

		it('combines event type + player + time filters', () => {
			const result = repo.query({
				eventTypes: ['chat_message'],
				player: 'eve',
				from: ts(3000),
				to: ts(1000),
			});
			expect(result.total).toBe(1);
			expect(result.items[0].playerName).toBe('Eve');
			expect(result.items[0].data.message).toBe('Anyone need a ride?');
		});

		it('returns empty when no rows match', () => {
			const result = repo.query({ event: 'nonexistent_event' });
			expect(result.items).toEqual([]);
			expect(result.total).toBe(0);
		});
	});

	describe('getEventTypes()', () => {
		beforeEach(() => seed());

		it('returns all distinct event type strings in alphabetical order', () => {
			const types = repo.getEventTypes();
			expect(types).toBeArray();
			expect(types.length).toBeGreaterThan(0);
			// Alphabetical order
			for (let i = 1; i < types.length; i++) {
				expect(types[i] >= types[i - 1]).toBeTrue();
			}
		});

		it('includes every event type from the seed', () => {
			const types = repo.getEventTypes(200);
			const expectedTypes = [
				...new Set(SEED_EVENTS.map((e) => e.event)),
			].sort();
			// All expected types should be present
			for (const expected of expectedTypes) {
				expect(types).toContain(expected);
			}
		});
	});

	describe('id format', () => {
		it('returns string ids (matching the EventLogEntry contract)', () => {
			const entry = repo.insert({ event: 'test_id', data: {} });
			expect(Number.isInteger(Number(entry.id))).toBeTrue();
			expect(entry.id).toBeTypeOf('string');
		});
	});
});
