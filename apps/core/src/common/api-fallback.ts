import type { FastifyReply, FastifyRequest } from 'fastify';

/** Registered before SPA routes: unknown API URLs must never receive index.html. */
export async function rejectUnknownApi(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	return reply.code(404).send({
		message:
			'API endpoint not found. Check that the core and webpanel versions match.',
		path: request.url.split('?')[0],
	});
}
