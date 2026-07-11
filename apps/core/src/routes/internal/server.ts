import type { ResourceData } from '@fxmanager/shared/types';
import { resourceAuth } from '../../middleware/resource';
import type { RouteModule } from '../../types';

const ServerEndpoints: RouteModule['handler'] = async (fastify, options) => {
	const { pm } = options;

	fastify.addHook('preHandler', resourceAuth);

	fastify.post('/ready', () => {
		pm.setFxServerReady();
	});
};

export default {
	prefix: '/server',
	handler: ServerEndpoints,
} satisfies RouteModule;
