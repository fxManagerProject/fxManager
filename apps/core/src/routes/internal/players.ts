import type {
	PlayerIdentifiers,
	PlayerUpdatePackage,
} from '@fxmanager/shared/types';
import { resourceAuth } from '../../middleware/resource';
import type { RouteModule } from '../../types';

const PlayerEndpoints: RouteModule['handler'] = async (fastify, options) => {
	const { gm } = options;

	fastify.addHook('preHandler', resourceAuth);

	fastify.post('/deferrals', async (request) => {
		const { body } = request;

		return await gm.playerDeferralChecks(
			(body as { identifiers: PlayerIdentifiers }).identifiers,
		);
	});

	fastify.post('/join', (request) => {
		const { body } = request;

		gm.playerJoin(
			body as {
				identifiers: PlayerIdentifiers;
				serverId: number;
				name: string;
			},
		);
		return { ack: true };
	});

	fastify.post('/drop', (request) => {
		const { body } = request;

		gm.playerDrop((body as { serverId: number }).serverId);
		return { ack: true };
	});

	fastify.post('/update', (request) => {
		const { body } = request;

		gm.playerUpdates((body as { payload: PlayerUpdatePackage }).payload);
		return { ack: true };
	});
};

export default {
	prefix: '/players',
	handler: PlayerEndpoints,
} satisfies RouteModule;
