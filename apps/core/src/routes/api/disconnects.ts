import { repo } from '@fxmanager/database';
import { zeroDisconnectCounts } from '@fxmanager/shared/types';
import { sessionAuth } from '../../middleware/session';
import type { RouteModule } from '../../types';

const DisconnectEndpoints: RouteModule['handler'] = async (fastify) => {
	fastify.addHook('preHandler', sessionAuth);

	fastify.get('/sessions', (request) => {
		const { limit } = request.query as { limit?: string };
		const parsed = parseInt(limit ?? '30', 10);
		const n = Math.min(Math.max(Number.isNaN(parsed) ? 30 : parsed, 1), 100);
		return repo.disconnects.listRecent(n);
	});

	fastify.get('/sessions/:id', (request) => {
		const { id } = request.params as { id: string };
		const { from, to } = request.query as { from?: string; to?: string };
		const sessionId = parseInt(id, 10);
		if (Number.isNaN(sessionId)) {
			return zeroDisconnectCounts();
		}
		const f = from ? parseInt(from, 10) : Number.NaN;
		const t = to ? parseInt(to, 10) : Number.NaN;
		if (!Number.isNaN(f) && !Number.isNaN(t)) {
			return repo.disconnects.countsInRange(sessionId, f, t);
		}
		return repo.disconnects.countsForSession(sessionId);
	});
};

export default {
	prefix: '/disconnects',
	handler: DisconnectEndpoints,
} satisfies RouteModule;
