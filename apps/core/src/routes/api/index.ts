import type { RouteModule } from '../../types';
import SetupModule from './setup';
import AuthModule from './auth';
import ServerModule from './server';
import PlayerModule from './players';
import WhitelistModule from './whitelist';
import WsModule from './sockets';
import SettingsModule from './settings';
import ResourcesModule from './resources';
import MigrateModule from './migrate';
import DisconnectsModule from './disconnects';
import PerfModule from './perf';
import ConfigModule from './config';

const apiRoutes: RouteModule['handler'] = async (fastify, options) => {
	fastify.register(SetupModule.handler, {
		...options,
		prefix: SetupModule.prefix,
	});
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

	fastify.register(MigrateModule.handler, {
		...options,
		prefix: MigrateModule.prefix,
	});

	fastify.register(DisconnectsModule.handler, {
		...options,
		prefix: DisconnectsModule.prefix,
	});

	fastify.register(PerfModule.handler, {
		...options,
		prefix: PerfModule.prefix,
	});

	fastify.register(ConfigModule.handler, {
		...options,
		prefix: ConfigModule.prefix,
	});
};

export default apiRoutes;
