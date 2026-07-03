import type { FastifyRequest, FastifyReply } from 'fastify';

const LOOPBACK_EXACT = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isLoopbackAddress(address: string | undefined): boolean {
	if (!address) return false;
	if (LOOPBACK_EXACT.has(address)) return true;

	return address.startsWith('127.') || address.startsWith('::ffff:127.');
}

export async function requireLoopback(req: FastifyRequest, reply: FastifyReply) {
	if (!isLoopbackAddress(req.socket.remoteAddress)) {
		return reply.code(403).send({ error: 'Forbidden' });
	}
}
