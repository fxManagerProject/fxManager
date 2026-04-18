import { randomUUID } from 'crypto';
import { wsManager } from '../../modules/ws.manager';
import type { AuthedRequest, RouteModule } from '../../types';
import type { ServerState, ProcessOutputLine } from '@fxmanager/shared/types';
import { sessionAuth } from '../../middleware/auth';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';

const wsEndpoints: RouteModule['handler'] = async (fastify, { pm }) => {
	
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
	})

	wsManager.setInitialData<ProcessOutputLine[]>('console', () => {
		return pm.getLogs();
	});

	wsManager.on<{ command: string }>('console', 'command', ({ id }, event, { command }) => {

		if (command.includes("resource-api-token") || command.includes("api-port")) {
			wsManager.send<ProcessOutputLine>(id, {
				channel: 'console',
				event: 'line',
				data: {
          line: '\x1b[31m[           fxManager] protected convar - \x1b[1maction denied\x1b[0m',
          source: 'stderr',
          ts: Date.now(),
				},
			});

			return;
		}

		pm.sendCommand(command);
	});
};

export default {
	prefix: '/ws',
	handler: wsEndpoints,
} satisfies RouteModule;
