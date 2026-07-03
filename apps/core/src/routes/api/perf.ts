import { repo } from '@fxmanager/database';
import type {
	PerfSeriesResponse,
	PerfSnapshot,
	RawPerf,
} from '@fxmanager/shared/types';
import { sessionAuth } from '../../middleware/session';
import type { RouteModule } from '../../types';

// newest 24h of 30s samples; older data is reachable via from/to
const MAX_SNAPSHOTS = 2880;

const PerfEndpoints: RouteModule['handler'] = async (fastify) => {
	fastify.addHook('preHandler', sessionAuth);

	fastify.get('/sessions', (request) => {
		const { limit } = request.query as { limit?: string };
		const parsed = parseInt(limit ?? '50', 10);
		const n = Math.min(Math.max(Number.isNaN(parsed) ? 50 : parsed, 1), 100);
		return repo.serverSessions.listRecent(n);
	});

	fastify.get('/sessions/:id', (request) => {
		const { id } = request.params as { id: string };
		const query = request.query as {
			from?: string;
			to?: string;
			limit?: string;
		};
		const sessionId = parseInt(id, 10);
		if (Number.isNaN(sessionId)) {
			return { sessionId: -1, snapshots: [] } satisfies PerfSeriesResponse;
		}
		const from = query.from ? parseInt(query.from, 10) : Number.NaN;
		const to = query.to ? parseInt(query.to, 10) : Number.NaN;
		const parsedLimit = parseInt(query.limit ?? '', 10);
		const limit = Math.min(
			Math.max(Number.isNaN(parsedLimit) ? MAX_SNAPSHOTS : parsedLimit, 1),
			MAX_SNAPSHOTS,
		);
		const snapshots: PerfSnapshot[] = repo.perfSnapshots
			.listForSession(sessionId, {
				from: Number.isNaN(from) ? undefined : from,
				to: Number.isNaN(to) ? undefined : to,
				limit,
			})
			.map((r) => ({
				ts: r.ts,
				players: r.players,
				threads: r.perf as RawPerf,
			}));
		return { sessionId, snapshots } satisfies PerfSeriesResponse;
	});
};

export default {
	prefix: '/perf',
	handler: PerfEndpoints,
} satisfies RouteModule;
