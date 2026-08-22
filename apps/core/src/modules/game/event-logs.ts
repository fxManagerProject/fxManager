import { repo } from '@fxmanager/database';
import type { EventLogEntry } from '@fxmanager/shared/types';
import { wsManager } from '../ws/manager';
import { sessionManager } from '../session/manager';

/** Input shape accepted from the ingame resource. */
export interface IncomingEvent {
	event: string;
	timestamp?: number;
	playerId?: number;
	playerName?: string;
	data?: Record<string, unknown>;
}

class EventLogManager {
	/**
	 * Ingest a single event: persist to DB, broadcast to WS clients on
	 * the `eventlogs` channel, and return the stored entry.
	 */
	ingest(event: IncomingEvent): EventLogEntry {
		const entry = repo.eventLogs.insert({
			event: event.event,
			timestamp: event.timestamp,
			playerId: event.playerId ?? null,
			playerName: event.playerName ?? null,
			serverSessionId: sessionManager.getCurrentId(),
			data: event.data ?? {},
		});

		wsManager.broadcast<EventLogEntry>({
			channel: 'eventlogs',
			event: 'entry',
			data: entry,
		});

		return entry;
	}

	/**
	 * Ingest a batch of events.  All are inserted in a single transaction,
	 * then broadcast one-by-one (so the frontend sees them arriving in order).
	 */
	ingestBatch(events: IncomingEvent[]): EventLogEntry[] {
		const sessionId = sessionManager.getCurrentId();
		const entries = repo.eventLogs.insertBatch(
			events.map((e) => ({
				event: e.event,
				timestamp: e.timestamp,
				playerId: e.playerId ?? null,
				playerName: e.playerName ?? null,
				serverSessionId: sessionId,
				data: e.data ?? {},
			})),
		);

		for (const entry of entries) {
			wsManager.broadcast<EventLogEntry>({
				channel: 'eventlogs',
				event: 'entry',
				data: entry,
			});
		}

		return entries;
	}

	/** Fetch the most recent N entries (for the WS initial-data provider). */
	getRecent(limit = 500): EventLogEntry[] {
		return repo.eventLogs.getRecent(limit);
	}
}

export const eventLogManager = new EventLogManager();
