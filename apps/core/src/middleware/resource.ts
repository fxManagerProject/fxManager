import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigManager } from '../modules/config.manager';

export async function resourceAuth(req: FastifyRequest, reply: FastifyReply) {
	const token = req.headers['x-resource-token'];
	const { resourceApiToken } = ConfigManager.getInstance().getSystemValues();

	if (!token || token !== resourceApiToken) {
		return reply.code(401).send({
			error: 'Unauthorized',
		});
	}
}
