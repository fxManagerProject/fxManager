import { randomUUID } from 'node:crypto';
import { repo } from '@fxmanager/database';
import { UserPermissions } from '@fxmanager/shared/constants';
import type {
	DisconnectSession,
	OnlinePlayer,
	PerfSnapshot,
	ProcessOutputLine,
	ResourceInitialData,
	ServerSession,
	ServerState,
} from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import { sessionAuth } from '../../middleware/session';
import { wsManager } from '../../modules/ws/manager';
import type { AuthedRequest, RouteModule } from '../../types';
import { resourceManager } from '../../modules/resource/manager';
import { perfManager } from '../../modules/perf/manager';
import { disconnectManager } from '../../modules/disconnect/manager';

wsManager.addCheck('console', (admin) => {
	return PermissionManager.has(
		admin.permissions,
		UserPermissions.CONSOLE_ACCESS,
	);
});

wsManager.addCheck('resourcelist', (admin) => {
	return PermissionManager.has(
		admin.permissions,
		UserPermissions.RESOURCE_LIST,
	);
});

const wsEndpoints: RouteModule['handler'] = async (fastify, { pm, gm }) => {
	fastify.addHook('preHandler', sessionAuth);

	fastify.get('', { websocket: true }, (socket, request) => {
		const clientId = randomUUID();
		const { admin } = request as AuthedRequest;
		wsManager.add(clientId, socket, admin);

		// Send client its assigned id so it can reference itself
		socket.send(JSON.stringify({ type: 'connected', clientId }));
	});

	wsManager.setInitialData<ServerState>('server_state', () => {
		return pm.getState();
	});

	wsManager.setInitialData<ProcessOutputLine[]>('console', () => {
		return pm.getLogs();
	});

	wsManager.on<{ command: string }>(
		'console',
		'command',
		({ admin }, _event, { command }) => {
			if (
				!PermissionManager.has(
					admin.permissions,
					UserPermissions.CONSOLE_ACCESS,
				)
			)
				return;

			pm.injectConsoleLine({
				process: `cmd:${admin.username}`,
				value: `\x1b[37m> ${command}\x1b[0m`,
			});

			if (
				command.includes('resource-api-token') ||
				command.includes('api-port')
			) {
				pm.injectConsoleLine({
					process: `fxManager`,
					value: `  Protected Convar - \x1b[1maction denied\x1b[0m`,
					color: '\x1b[31m',
				});
			} else if (/^(start|stop|ensure|restart)\s+fxManager/.test(command)) {
				pm.injectConsoleLine({
					process: `fxManager`,
					value: `  Cannot perform action on protected resource \x1b[1mfxManager\x1b[0m`,
					color: '\x1b[31m',
				});
			} else {
				pm.sendCommand(command);
			}
		},
	);

	wsManager.setInitialData<ServerState>('server_state', () => {
		return pm.getState();
	});

	wsManager.setInitialData<OnlinePlayer[]>('playerlist', () => {
		return gm.getPlayerList();
	});

	wsManager.setInitialData<ResourceInitialData>('resourcelist', () => {
		return resourceManager.getResourceList();
	});

	// backfill new clients with the last 30 min of samples
	wsManager.setInitialData<PerfSnapshot[]>('perf', () => {
		return perfManager.getRecent();
	});

	wsManager.setInitialData<ServerSession[]>('sessions', () => {
		return repo.serverSessions.listRecent(50);
	});

	wsManager.setInitialData<DisconnectSession | null>('disconnects', () => {
		return disconnectManager.getLiveSession();
	});
};

export default {
	prefix: '/ws',
	handler: wsEndpoints,
} satisfies RouteModule;
