import type { Database } from 'bun:sqlite';
import {
	INCIDENT_DEFAULT_LIMITS,
	INCIDENT_MAX_EVIDENCE,
	type IncidentEvent,
	type IncidentSummary,
	type IncidentDetail,
	type IncidentNote,
	type IncidentLimits,
} from '@fxmanager/shared/types';

const DAY = 86_400_000;
const columns =
	'id, title, description, from_ts AS "from", to_ts AS "to", created_at AS createdAt, status, resolved_at AS resolvedAt, event_count AS eventCount';
type EventRow = Omit<IncidentEvent, 'data'> & { data: string };
const decodeEvent = (row: EventRow): IncidentEvent => ({
	...row,
	data: JSON.parse(row.data),
});
const bytes = (value: string) => Buffer.byteLength(value, 'utf8') + 128;

export class IncidentInputError extends Error {}

/** Uses the existing SQLite connection; all multi-row mutations are transactional. */
export class IncidentsRepository {
	constructor(private readonly db: Database) {}

	limits(): IncidentLimits {
		const read = (key: string, fallback: number, min: number, max: number) => {
			const row = this.db
				.query<{ value: string }, [string]>(
					'SELECT value FROM settings WHERE key = ?',
				)
				.get(key);
			const value = Number(row?.value ?? fallback);
			return Number.isInteger(value) && value >= min && value <= max
				? value
				: fallback;
		};
		return {
			retentionDays: read(
				'incidents.retentionDays',
				INCIDENT_DEFAULT_LIMITS.retentionDays,
				1,
				365,
			),
			maxStorageMB: read(
				'incidents.maxStorageMB',
				INCIDENT_DEFAULT_LIMITS.maxStorageMB,
				16,
				2048,
			),
		};
	}

	setLimits(limits: IncidentLimits, now = Date.now()) {
		this.db.transaction(() => {
			const statement = this.db.query(
				'INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
			);
			statement.run(
				'incidents.retentionDays',
				String(limits.retentionDays),
				Math.floor(now / 1000),
			);
			statement.run(
				'incidents.maxStorageMB',
				String(limits.maxStorageMB),
				Math.floor(now / 1000),
			);
			this.prune(now);
		})();
	}

	append(events: Omit<IncidentEvent, 'id'>[]) {
		this.db.transaction(() => {
			const insert = this.db.query(
				'INSERT INTO incident_events(ts, kind, summary, data, bytes) VALUES (?, ?, ?, ?, ?)',
			);
			for (const event of events) {
				const data = JSON.stringify(event.data);
				insert.run(
					event.ts,
					event.kind,
					event.summary,
					data,
					bytes(data + event.summary),
				);
			}
		})();
	}

	timeline(from: number, to: number, cursor = 0, kind?: string, limit = 100) {
		const position = cursor
			? this.db
					.query<{ ts: number }, [number]>(
						'SELECT ts FROM incident_events WHERE id = ?',
					)
					.get(cursor)
			: null;
		if (cursor && !position)
			throw new IncidentInputError(
				'This history page has expired. Refresh the timeline.',
			);
		const after = position?.ts ?? -1;
		const rows = this.db
			.query<
				EventRow,
				[
					number,
					number,
					number,
					number,
					number,
					string | null,
					string | null,
					number,
				]
			>(
				'SELECT id, ts, kind, summary, data FROM incident_events WHERE ts >= ? AND ts <= ? AND (ts > ? OR (ts = ? AND id > ?)) AND (? IS NULL OR kind = ?) ORDER BY ts, id LIMIT ?',
			)
			.all(
				from,
				to,
				after,
				after,
				cursor,
				kind ?? null,
				kind ?? null,
				limit + 1,
			);
		const items = rows.slice(0, limit).map(decodeEvent);
		return {
			items,
			nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
		};
	}

	list(cursor = Number.MAX_SAFE_INTEGER) {
		const rows = this.db
			.query<IncidentSummary, [number]>(
				`SELECT ${columns} FROM incidents WHERE id < ? ORDER BY id DESC LIMIT 51`,
			)
			.all(cursor);
		const items = rows.slice(0, 50);
		return {
			items,
			nextCursor: rows.length > 50 ? (items.at(-1)?.id ?? null) : null,
		};
	}

	get(id: number): IncidentDetail | null {
		const row = this.db
			.query<IncidentSummary & { evidence: string }, [number]>(
				`SELECT ${columns}, evidence FROM incidents WHERE id = ?`,
			)
			.get(id);
		if (!row) return null;
		const notes = this.db
			.query<IncidentNote, [number]>(
				'SELECT id, incident_id AS incidentId, content, created_at AS createdAt FROM incident_notes WHERE incident_id = ? ORDER BY id',
			)
			.all(id);
		return { ...row, evidence: JSON.parse(row.evidence), notes };
	}

	create(
		input: { title: string; description: string; from: number; to: number },
		adminId: number,
		now = Date.now(),
	) {
		return this.db.transaction(() => {
			this.prune(now);
			const rows = this.db
				.query<EventRow, [number, number, number]>(
					'SELECT id, ts, kind, summary, data FROM incident_events WHERE ts >= ? AND ts <= ? ORDER BY ts, id LIMIT ?',
				)
				.all(input.from, input.to, INCIDENT_MAX_EVIDENCE + 1);
			if (rows.length === 0)
				throw new IncidentInputError(
					'No recorded events in this range. Select a range from the available timeline.',
				);
			if (rows.length > INCIDENT_MAX_EVIDENCE)
				throw new IncidentInputError(
					'This range exceeds 5,000 events. Choose a narrower time range.',
				);
			const evidence = JSON.stringify(rows.map(decodeEvent));
			const size = bytes(evidence + input.title + input.description);
			if (size > (this.limits().maxStorageMB * 1024 * 1024) / 2)
				throw new IncidentInputError(
					'Evidence exceeds half the storage budget. Narrow the time range or increase the limit.',
				);
			const result = this.db
				.query<
					{ id: number },
					[
						string,
						string,
						number,
						number,
						number,
						number,
						string,
						number,
						number,
					]
				>(
					'INSERT INTO incidents(title, description, from_ts, to_ts, created_at, created_by, evidence, event_count, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
				)
				.get(
					input.title,
					input.description,
					input.from,
					input.to,
					now,
					adminId,
					evidence,
					rows.length,
					size,
				);
			if (!result) throw new Error('Incident insert failed');
			this.prune(now);
			const incident = this.get(result.id);
			if (!incident)
				throw new Error('Created incident was unexpectedly evicted');
			return incident;
		})();
	}

	addNote(id: number, content: string, adminId: number, now = Date.now()) {
		return this.db.transaction(() => {
			if (!this.get(id)) return null;
			const count =
				this.db
					.query<{ count: number }, [number]>(
						'SELECT count(*) AS count FROM incident_notes WHERE incident_id = ?',
					)
					.get(id)?.count ?? 0;
			if (count >= 200)
				throw new IncidentInputError(
					'An incident can contain at most 200 notes.',
				);
			this.db
				.query(
					'INSERT INTO incident_notes(incident_id, content, created_at, created_by, bytes) VALUES (?, ?, ?, ?, ?)',
				)
				.run(id, content, now, adminId, bytes(content));
			this.prune(now);
			return this.get(id);
		})();
	}

	setStatus(id: number, status: 'open' | 'resolved', now = Date.now()) {
		this.db
			.query(
				'UPDATE incidents SET status = ?, resolved_at = ? WHERE id = ? AND status != ?',
			)
			.run(status, status === 'resolved' ? now : null, id, status);
		return this.get(id);
	}

	storage() {
		const usedBytes =
			this.db
				.query<{ total: number }, []>(
					'SELECT (SELECT coalesce(sum(bytes), 0) FROM incident_events) + (SELECT coalesce(sum(bytes), 0) FROM incidents) + (SELECT coalesce(sum(bytes), 0) FROM incident_notes) AS total',
				)
				.get()?.total ?? 0;
		const oldestEventAt =
			this.db
				.query<{ ts: number | null }, []>(
					'SELECT min(ts) AS ts FROM incident_events',
				)
				.get()?.ts ?? null;
		return { ...this.limits(), usedBytes, oldestEventAt };
	}

	prune(now = Date.now()) {
		this.db.transaction(() => {
			const { retentionDays, maxStorageMB } = this.limits();
			this.db
				.query('DELETE FROM incident_events WHERE ts < ?')
				.run(now - retentionDays * DAY);
			this.db
				.query('DELETE FROM incidents WHERE created_at < ?')
				.run(now - retentionDays * DAY);
			let excess = this.storage().usedBytes - maxStorageMB * 1024 * 1024;
			if (excess <= 0) return;
			// Evict oldest unpinned history first. Evidence copies are independent.
			this.db
				.query(`DELETE FROM incident_events WHERE id IN (
				SELECT id FROM (SELECT id, sum(bytes) OVER (ORDER BY ts, id) - bytes AS preceding FROM incident_events) WHERE preceding < ?
			)`)
				.run(excess);
			excess = this.storage().usedBytes - maxStorageMB * 1024 * 1024;
			if (excess <= 0) return;
			this.db
				.query(`DELETE FROM incidents WHERE id IN (
				SELECT id FROM (SELECT id, sum(size) OVER (ORDER BY created_at, id) - size AS preceding FROM (
					SELECT i.id, i.created_at, i.bytes + coalesce((SELECT sum(n.bytes) FROM incident_notes n WHERE n.incident_id = i.id), 0) AS size FROM incidents i
				)) WHERE preceding < ?
			)`)
				.run(excess);
		})();
	}
}
