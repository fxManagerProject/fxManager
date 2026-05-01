import PlayerModule from './players';
import ResourceModule from './resources';
import type { RouteModule } from '../../types';

const internalRoutes: RouteModule['handler'] = async (fastify, options) => {
	fastify.register(PlayerModule.handler, {
		...options,
		prefix: PlayerModule.prefix,
	});

	fastify.register(ResourceModule.handler, {
		...options,
		prefix: ResourceModule.prefix,
	});
};

export default internalRoutes;
