import { repo } from '@fxmanager/database';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import type { AuthedRequest, RouteModule } from '../../types';
import { sessionAuth } from '../../middleware/session';
import { resourceManager } from '../../modules/resource/manager';

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

		repo.audit.log({
			adminId: admin.id,
			action: 'server.start',
			metadata: { success: result },
		});

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

		repo.audit.log({
			adminId: admin.id,
			action: 'server.stop',
			metadata: { success: result },
		});

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

		repo.audit.log({
			adminId: admin.id,
			action: 'server.restart',
			metadata: { success: result },
		});

		return reply.code(result ? 200 : 500).send({ success: result });
	});

	fastify.post('/resource/action/start', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.RESOURCE_LIST,
		);

		if (!allowed) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const body = request.body as { action: 'start' | 'stop'; resource: string };

		pm.injectConsoleLine({
			process: `cmd:${admin.username}`,
			value: `\x1b[37m> ensure ${body.resource}\x1b[0m`,
		});
		pm.sendCommand(`ensure ${body.resource}`);

		return reply.code(200);
	});

	fastify.post('/resource/action/stop', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.RESOURCE_LIST,
		);

		if (!allowed) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const body = request.body as { resource: string };

		pm.injectConsoleLine({
			process: `cmd:${admin.username}`,
			value: `\x1b[37m> stop ${body.resource}\x1b[0m`,
		});

		pm.sendCommand(`stop ${body.resource}`);

		return reply.code(200);
	});

	fastify.post('/resource/action/refresh', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		const allowed = PermissionManager.has(
			admin.permissions,
			UserPermissions.RESOURCE_LIST,
		);

		if (!allowed) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		pm.injectConsoleLine({
			process: `cmd:${admin.username}`,
			value: `\x1b[37m> refresh\x1b[0m`,
		});

		pm.sendCommand(`refresh`);

		await resourceManager.loadResources();

		return reply.code(200).send({ success: true });
	});
};

export default {
	prefix: '/server',
	handler: ServerEndpoints,
} satisfies RouteModule;
