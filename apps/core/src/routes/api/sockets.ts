import { randomUUID } from 'crypto';
import { wsManager } from '../../modules/ws.manager';
import type { RouteModule } from '../../types';
import type { ProcessOutputLine } from '@fxmanager/shared/types';

// ToDo: add authentication checks

const wsEndpoints: RouteModule['handler'] = async (fastify, { pm }) => {
  fastify.get('', { websocket: true }, (socket, request) => {
    const clientId = randomUUID();
    wsManager.add(clientId, socket);

    // Send client its assigned id so it can reference itself
    socket.send(JSON.stringify({ type: 'connected', clientId }));
  });

	wsManager.on<{ command: string }>('console', 'command', (clientId, event, { command }) => {
		if (command.includes("resource-api-token") || command.includes("api-port")) {
			wsManager.send<ProcessOutputLine>(clientId, {
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
