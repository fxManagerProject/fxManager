import type { ResourceData } from '@fxmanager/shared/types';
import { resourceAuth } from '../../middleware/resource';
import { resourceManager } from '../../modules/resource/manager';
import type { RouteModule } from '../../types';

const ResourceEndpoints: RouteModule['handler'] = async (fastify) => {
	fastify.addHook('preHandler', resourceAuth);

	fastify.post('/update', (request) => {
		const { body } = request;

		resourceManager.handleResourceUpdate({
			event: 'update',
			data: body as ResourceData,
		});

		return { ack: true };
	});

	fastify.post('/refresh', (request) => {
		const { body } = request;

		resourceManager.handleResourceUpdate({
			event: 'refresh',
			data: body as ResourceData[],
		});

		return { ack: true };
	});
};

export default {
	prefix: '/resources',
	handler: ResourceEndpoints,
} satisfies RouteModule;
