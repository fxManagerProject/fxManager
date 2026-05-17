import type { RouteModule } from '../../types';
import AuthModule from './auth';
import ServerModule from './server';
import PlayerModule from './players';
import WhitelistModule from './whitelist';
import WsModule from './sockets';
import SettingsModule from './settings';
import ResourcesModule from './resources';

const apiRoutes: RouteModule['handler'] = async (fastify, options) => {
	fastify.register(AuthModule.handler, {
		...options,
		prefix: AuthModule.prefix,
	});

	fastify.register(ServerModule.handler, {
		...options,
		prefix: ServerModule.prefix,
	});

	fastify.register(PlayerModule.handler, {
		...options,
		prefix: PlayerModule.prefix,
	});

	fastify.register(ResourcesModule.handler, {
		...options,
		prefix: ResourcesModule.prefix,
	});

	fastify.register(WhitelistModule.handler, {
		...options,
		prefix: WhitelistModule.prefix,
	});

	fastify.register(SettingsModule.handler, {
		...options,
		prefix: SettingsModule.prefix,
	});

	fastify.register(WsModule.handler, {
		...options,
		prefix: WsModule.prefix,
	});
};

export default apiRoutes;
