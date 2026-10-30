import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrations, runMigrations } from '../migrations';
import { IncidentsRepository } from './incidents';

describe('incident persistence and retention', () => {
	let db: Database;
	let repo: IncidentsRepository;
	const now = 1_800_000_000_000;
	const day = 86_400_000;
	const event = (ts: number, summary = 'Resource started') => ({
		ts,
		kind: 'resource' as const,
		summary,
		data: { name: 'example', status: 'started' },
	});
	const create = (from = now - 1000, to = now) =>
		repo.create(
			{ title: 'Investigation', description: 'Details', from, to },
			1,
			now,
		);
	beforeEach(() => {
		db = new Database(':memory:');
		db.run('PRAGMA foreign_keys = ON');
		runMigrations(db, migrations);
		db.run(
			"INSERT INTO admin_users(id, username, password_hash, created_at) VALUES (1, 'admin', 'unused', 0)",
		);
		repo = new IncidentsRepository(db);
	});
	afterEach(() => db.close());

	it('captures evidence transactionally and survives history and session deletion', () => {
		repo.append([event(now - 1000), event(now)]);
		const incident = create();
		db.run('DELETE FROM incident_events');
		db.run('DELETE FROM server_sessions');
		expect(repo.get(incident.id)?.evidence).toHaveLength(2);
		expect(repo.timeline(now - 1000, now).items).toHaveLength(0);
	});

	it('paginates equal-time events without duplication and filters event kinds', () => {
		repo.append(Array.from({ length: 105 }, () => event(now)));
		const first = repo.timeline(now, now);
		const next = repo.timeline(now, now, first.nextCursor ?? undefined);
		expect(first.items).toHaveLength(100);
		expect(next.items).toHaveLength(5);
		expect(
			new Set([...first.items, ...next.items].map((row) => row.id)).size,
		).toBe(105);
		expect(repo.timeline(now, now, 0, 'console').items).toHaveLength(0);
	});

	it('expires evidence from incident creation rather than event timestamp and cascades notes', () => {
		repo.append([event(now - 29 * day)]);
		const incident = create(now - 29 * day, now - 29 * day);
		repo.addNote(incident.id, 'Investigating', 1, now);
		repo.prune(now + 2 * day);
		expect(repo.timeline(0, now).items).toHaveLength(0);
		expect(repo.get(incident.id)?.notes).toHaveLength(1);
		repo.prune(now + 31 * day);
		expect(repo.get(incident.id)).toBeNull();
		expect(db.query('SELECT * FROM incident_notes').all()).toHaveLength(0);
	});

	it('orders delayed events chronologically and handles expired pagination cursors', () => {
		repo.append([event(now), event(now - 1000), event(now - 500)]);
		const first = repo.timeline(now - 1000, now, 0, undefined, 2);
		expect(first.items.map((row) => row.ts)).toEqual([now - 1000, now - 500]);
		expect(
			repo
				.timeline(now - 1000, now, first.nextCursor ?? undefined)
				.items.map((row) => row.ts),
		).toEqual([now]);
		db.run('DELETE FROM incident_events WHERE id = ?', [first.nextCursor]);
		expect(() =>
			repo.timeline(now - 1000, now, first.nextCursor ?? undefined),
		).toThrow('expired');
	});

	it('rejects empty or oversized snapshots without partially creating an incident', () => {
		expect(() => create()).toThrow('No recorded events');
		repo.append(Array.from({ length: 5001 }, () => event(now)));
		expect(() => create()).toThrow('5,000');
		expect(repo.list().items).toHaveLength(0);
	});

	it('enforces the payload budget by evicting oldest history and then oldest incidents', () => {
		repo.setLimits({ retentionDays: 30, maxStorageMB: 16 }, now);
		repo.append([event(now - 1000)]);
		const first = create();
		repo.addNote(first.id, 'old note', 1, now);
		const second = repo.create(
			{ title: 'Second', description: '', from: now - 1000, to: now },
			1,
			now + 1,
		);
		// Simulated accounting makes the eviction order deterministic without huge fixtures.
		db.run('UPDATE incidents SET bytes = ?', [10 * 1024 * 1024]);
		repo.prune(now + 2);
		expect(repo.timeline(0, now).items).toHaveLength(0);
		expect(repo.get(first.id)).toBeNull();
		expect(repo.get(second.id)).not.toBeNull();
		expect(repo.storage().usedBytes).toBeLessThanOrEqual(16 * 1024 * 1024);
	});

	it('supports notes and idempotent resolve/reopen, retaining incidents when an admin is deleted', () => {
		repo.append([event(now)]);
		const incident = create();
		repo.addNote(incident.id, 'Found a config change', 1, now);
		repo.setStatus(incident.id, 'resolved', now + 1);
		expect(repo.setStatus(incident.id, 'resolved', now + 2)?.resolvedAt).toBe(
			now + 1,
		);
		expect(repo.setStatus(incident.id, 'open', now + 3)?.resolvedAt).toBeNull();
		db.run('DELETE FROM admin_users');
		expect(repo.get(incident.id)?.notes[0]?.content).toBe(
			'Found a config change',
		);
	});
});
