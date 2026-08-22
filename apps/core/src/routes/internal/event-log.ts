import { resourceAuth } from '../../middleware/resource';
import { eventLogManager } from '../../modules/game/event-logs';
import type { RouteModule } from '../../types';

const EventLogEndpoints: RouteModule['handler'] = async (fastify) => {
	fastify.addHook('preHandler', resourceAuth);

	/** POST a single event. */
	fastify.post('/', async (request, reply) => {
		const body = request.body as {
			event?: unknown;
			timestamp?: unknown;
			playerId?: unknown;
			playerName?: unknown;
			data?: unknown;
		};

		if (typeof body.event !== 'string' || body.event.length === 0) {
			return reply.code(400).send({ message: 'event_required' });
		}

		if (body.timestamp !== undefined && typeof body.timestamp !== 'number') {
			return reply.code(400).send({ message: 'invalid_timestamp' });
		}

		const entry = eventLogManager.ingest({
			event: body.event,
			timestamp:
				typeof body.timestamp === 'number' ? body.timestamp : undefined,
			playerId: typeof body.playerId === 'number' ? body.playerId : undefined,
			playerName:
				typeof body.playerName === 'string' ? body.playerName : undefined,
			data:
				body.data && typeof body.data === 'object'
					? (body.data as Record<string, unknown>)
					: undefined,
		});

		return { id: entry.id };
	});

	/** POST a batch of events. */
	fastify.post('/batch', async (request, reply) => {
		const body = request.body as { events?: unknown };

		if (!Array.isArray(body.events) || body.events.length === 0) {
			return reply.code(400).send({ message: 'events_array_required' });
		}

		const parsed = body.events as Array<{
			event?: unknown;
			timestamp?: unknown;
			playerId?: unknown;
			playerName?: unknown;
			data?: unknown;
		}>;

		for (const e of parsed) {
			if (typeof e.event !== 'string' || e.event.length === 0) {
				return reply.code(400).send({ message: 'event_required_in_batch' });
			}
		}

		const entries = eventLogManager.ingestBatch(
			parsed.map((e) => ({
				event: e.event as string,
				timestamp: typeof e.timestamp === 'number' ? e.timestamp : undefined,
				playerId: typeof e.playerId === 'number' ? e.playerId : undefined,
				playerName: typeof e.playerName === 'string' ? e.playerName : undefined,
				data:
					e.data && typeof e.data === 'object'
						? (e.data as Record<string, unknown>)
						: undefined,
			})),
		);

		return { ids: entries.map((e) => e.id) };
	});
};

export default {
	prefix: '/event-log',
	handler: EventLogEndpoints,
} satisfies RouteModule;
