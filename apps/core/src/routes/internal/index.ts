import PlayerModule from './players';
import ResourceModule from './resources';
import IngameModule from './ingame';
import { requireLoopback } from '../../middleware/loopback';
import type { RouteModule } from '../../types';

const internalRoutes: RouteModule['handler'] = async (fastify, options) => {
	fastify.addHook('onRequest', requireLoopback);

	fastify.register(PlayerModule.handler, {
		...options,
		prefix: PlayerModule.prefix,
	});

	fastify.register(ResourceModule.handler, {
		...options,
		prefix: ResourceModule.prefix,
	});

	fastify.register(IngameModule.handler, {
		...options,
		prefix: IngameModule.prefix,
	});
};

export default internalRoutes;
