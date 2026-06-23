import type { AuthedRequest, RouteModule } from '../../types';
import { sessionAuth } from '../../middleware/session';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import { resourceManager } from '../../modules/resource/manager';

const ResourceEndpoints: RouteModule['handler'] = async (fastify, options) => {
	const { pm } = options;

	// enforces that admin key exists in request otherwise returns 401
	fastify.addHook('preHandler', sessionAuth);

	fastify.post('/action/start', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.RESOURCE_LIST,
		);

		if (!allowed) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		if (pm.getState().status !== 'running') {
			return reply.code(500).send({ error: 'Server is not running' });
		}

		const body = request.body as { action: 'start' | 'stop'; resource: string };

		pm.injectConsoleLine({
			process: `cmd:${admin.username}`,
			value: `\x1b[37m> ensure ${body.resource}\x1b[0m`,
		});
		pm.sendCommand(`ensure ${body.resource}`);

		return reply.code(200).send({ success: true });
	});

	fastify.post('/action/stop', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.RESOURCE_LIST,
		);

		if (!allowed) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		if (pm.getState().status !== 'running') {
			return reply.code(500).send({ error: 'Server is not running' });
		}

		const body = request.body as { resource: string };

		pm.injectConsoleLine({
			process: `cmd:${admin.username}`,
			value: `\x1b[37m> stop ${body.resource}\x1b[0m`,
		});

		pm.sendCommand(`stop ${body.resource}`);

		return reply.code(200).send({ success: true });
	});

	fastify.post('/action/refresh', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.RESOURCE_LIST,
		);

		if (!allowed) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		if (pm.getState().status !== 'running') {
			return reply.code(500).send({ error: 'Server is not running' });
		}

		pm.injectConsoleLine({
			process: `cmd:${admin.username}`,
			value: `\x1b[37m> refresh\x1b[0m`,
		});

		pm.sendCommand(`refresh`);

		// wait 500ms to guarantee list has updated
		await new Promise((resolve) => setTimeout(resolve, 500, null));

		await resourceManager.loadResources();

		return reply.code(200).send({ success: true });
	});
};

export default {
	prefix: '/resources',
	handler: ResourceEndpoints,
} satisfies RouteModule;
