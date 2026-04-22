import type { AuthedRequest, RouteModule } from '../../types';
import { sessionAuth } from '../../middleware/session';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';

const ServerEndpoints: RouteModule['handler'] = async (fastify, options) => {
	const { pm } = options;

	// enforces that admin key exists in request otherwise returns 401
	fastify.addHook('preHandler', sessionAuth);

	fastify.post('/start', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.SERVER_ACTIONS,
		);

		if (!allowed) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const result = await pm.start();

		return reply.code(result ? 200 : 500).send({ success: result });
	});

	fastify.post('/stop', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.SERVER_ACTIONS,
		);

		if (!allowed) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const result = await pm.stop();

		return reply.code(result ? 200 : 500).send({ success: result });
	});

	fastify.post('/restart', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.SERVER_ACTIONS,
		);

		if (!allowed) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const result = await pm.restart();

		return reply.code(result ? 200 : 500).send({ success: result });
	});
};

export default {
	prefix: '/server',
	handler: ServerEndpoints,
} satisfies RouteModule;
