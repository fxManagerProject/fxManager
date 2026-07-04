import { repo } from '@fxmanager/database';
import {
	PermissionManager,
	isValidResourceName,
} from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import type { AuthedRequest, RouteModule } from '../../types';
import { sessionAuth } from '../../middleware/session';
import { resourceManager } from '../../modules/resource/manager';
import { getRecommendedArtifact } from '../../common/recommended-artifact';
import { getVersionStatus } from '../../common/version_check';
import { restartScheduler } from '../../modules/schedule/manager';

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

		const result = await pm.stop({
			author: admin.username,
			message: 'Server stopped by an admin.',
		});

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

		const result = await pm.restart({
			author: admin.username,
			message: 'Server is restarting.',
		});

		repo.audit.log({
			adminId: admin.id,
			action: 'server.restart',
			metadata: { success: result },
		});

		return reply.code(result ? 200 : 500).send({ success: result });
	});

	fastify.get('/artifact/recommended', async (_request, reply) => {
		const recommended = await getRecommendedArtifact();
		return reply.code(200).send({ recommended });
	});

	fastify.get('/version', async (_request, reply) => {
		const version = await getVersionStatus();
		return reply.code(200).send(version);
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

		if (!isValidResourceName(body.resource)) {
			return reply.code(400).send({ error: 'Invalid resource name' });
		}

		pm.injectConsoleLine({
			process: `cmd:${admin.username}`,
			value: `\x1b[37m> ensure ${body.resource}\x1b[0m`,
		});
		pm.sendCommand(`ensure ${body.resource}`);

		return reply.code(200).send({ success: true });
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

		if (!isValidResourceName(body.resource)) {
			return reply.code(400).send({ error: 'Invalid resource name' });
		}

		pm.injectConsoleLine({
			process: `cmd:${admin.username}`,
			value: `\x1b[37m> stop ${body.resource}\x1b[0m`,
		});

		pm.sendCommand(`stop ${body.resource}`);

		return reply.code(200).send({ success: true });
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

	fastify.get('/schedule', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		if (
			!PermissionManager.has(admin.permissions, UserPermissions.SERVER_ACTIONS)
		) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		return reply
			.code(200)
			.send({ success: true, data: restartScheduler.getStatus() });
	});

	fastify.post('/schedule/skip', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		if (
			!PermissionManager.has(admin.permissions, UserPermissions.SERVER_ACTIONS)
		) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const result = restartScheduler.skipNext(admin.username);

		if (result.skipped) {
			repo.audit.log({
				adminId: admin.id,
				action: 'server.restart',
				metadata: { skippedScheduledRestart: result.nextRestart },
			});
		}

		return reply.code(200).send({ success: true, data: result });
	});

	fastify.post('/schedule/restart-in', async (request, reply) => {
		const { admin } = request as AuthedRequest;

		if (
			!PermissionManager.has(admin.permissions, UserPermissions.SERVER_ACTIONS)
		) {
			return reply.code(403).send({ error: 'Not authorized' });
		}

		const { minutes } = request.body as { minutes?: number };
		if (
			typeof minutes !== 'number' ||
			!Number.isFinite(minutes) ||
			minutes < 1 ||
			minutes > 1440
		) {
			return reply
				.code(400)
				.send({ success: false, error: 'minutes must be between 1 and 1440' });
		}

		const result = restartScheduler.scheduleTemp(Math.round(minutes));

		repo.audit.log({
			adminId: admin.id,
			action: 'server.restart',
			metadata: { temporaryRestartIn: minutes, at: result.nextRestart },
		});

		return reply.code(200).send({ success: true, data: result });
	});
};

export default {
	prefix: '/server',
	handler: ServerEndpoints,
} satisfies RouteModule;
