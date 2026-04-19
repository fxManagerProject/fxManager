import AuthModule from "./auth";
import ServerModule from "./server";
import PlayerModule from "./players";
import WsModule from "./sockets";
import type { RouteModule } from "../../types";

const apiRoutes: RouteModule['handler'] = async (fastify, options) => {
  fastify.register(AuthModule.handler, { 
    ...options, 
    prefix: AuthModule.prefix 
  });
  
  fastify.register(ServerModule.handler, { 
    ...options, 
    prefix: ServerModule.prefix 
  });
  
  fastify.register(PlayerModule.handler, { 
    ...options, 
    prefix: PlayerModule.prefix 
  });
  
  fastify.register(WsModule.handler, { 
    ...options, 
    prefix: WsModule.prefix 
  });
};

export default apiRoutes;
