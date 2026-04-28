import { randomUUID } from 'node:crypto';
import { UserPermissions } from '@fxmanager/shared/constants';
import type {
	OnlinePlayer,
	ProcessOutputLine,
	ServerState,
} from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import { sessionAuth } from '../../middleware/session';
import { wsManager } from '../../modules/ws.manager';
import type { AuthedRequest, RouteModule } from '../../types';

wsManager.addCheck('console', (admin) => {
	return PermissionManager.has(
		admin.permissions,
		UserPermissions.CONSOLE_ACCESS,
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
				return;
			}
			pm.sendCommand(command);
		},
	);

	wsManager.setInitialData<ServerState>('server_state', () => {
		return pm.getState();
	});

	wsManager.setInitialData<OnlinePlayer[]>('playerlist', () => {
		return gm.getPlayerList();
	});
};

export default {
	prefix: '/ws',
	handler: wsEndpoints,
} satisfies RouteModule;
