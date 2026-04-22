import type { FastifyRequest, FastifyReply } from 'fastify';
import { loadConfig } from '../common/config';

export async function resourceAuth(req: FastifyRequest, reply: FastifyReply) {
	const token = req.headers['x-resource-token'];
	const { resourceApiToken } = loadConfig();

	if (!token || token !== resourceApiToken) {
		return reply.code(401).send({
			error: 'Unauthorized',
		});
	}
}
