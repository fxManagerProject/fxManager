import type { FastifyRequest, FastifyReply } from 'fastify';
import { repo } from '@fxmanager/database';
import { COOKIE_NAME } from '../common/utils';

export async function sessionAuth(req: FastifyRequest, reply: FastifyReply) {
	const sessionId = req.cookies?.[COOKIE_NAME];

	if (!sessionId) {
		return reply.status(401).send({ error: 'Not authenticated' });
	}

	const result = repo.auth.validateSession(sessionId);

	if (!result) {
		return reply.status(401).send({ error: 'Session expired' });
	}

	// attach to request
	req.admin = {
		id: result.user.id,
		username: result.user.username,
		permissions: result.effectivePermissions,
	};
}
