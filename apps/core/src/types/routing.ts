import type { FastifyPluginAsync } from "fastify";
import 'fastify';

export interface RouteModule {
	prefix: string;
	handler: FastifyPluginAsync;
}

declare module 'fastify' {
  interface FastifyRequest {
    admin?: {
      id: number;
      username: string;
      permissions: number;
    };
  }
}
