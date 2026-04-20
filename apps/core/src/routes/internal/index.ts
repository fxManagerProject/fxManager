import PlayerModule from "./players";
import type { RouteModule } from "../../types";

const internalRoutes: RouteModule['handler'] = async (fastify, options) => {
	fastify.register(PlayerModule.handler, { 
		...options, 
		prefix: PlayerModule.prefix 
	});
};

export default internalRoutes;
