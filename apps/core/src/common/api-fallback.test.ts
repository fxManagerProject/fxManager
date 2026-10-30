import { expect, it } from 'bun:test';
import Fastify from 'fastify';
import { rejectUnknownApi } from './api-fallback';

it('keeps API misses out of the SPA while preserving real API and page routes', async () => {
	const app = Fastify();
	app.all('/api', rejectUnknownApi);
	app.all('/api/*', rejectUnknownApi);
	app.get('/api/health', async () => ({ status: 'ok' }));
	app.get('/*', async (_request, reply) =>
		reply.type('text/html').send('<!doctype html>'),
	);
	try {
		for (const url of [
			'/api',
			'/api/unknown?token=private',
			'/api/incidents/missing',
		]) {
			const response = await app.inject(url);
			expect(response.statusCode).toBe(404);
			expect(response.headers['content-type']).toContain('application/json');
			expect(response.body).not.toContain('private');
		}
		expect(
			(await app.inject('/api/health')).json<{ status: string }>(),
		).toEqual({ status: 'ok' });
		expect((await app.inject('/incidents')).headers['content-type']).toContain(
			'text/html',
		);
	} finally {
		await app.close();
	}
});
