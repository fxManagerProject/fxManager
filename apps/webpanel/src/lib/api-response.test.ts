import { describe, expect, it } from 'bun:test';
import { readApiResponse } from './api-response';

describe('API response decoding', () => {
	it('rejects an HTML SPA fallback with an actionable error instead of a JSON syntax error', async () => {
		const response = new Response('<!doctype html><html></html>', {
			headers: { 'content-type': 'text/html' },
		});
		await expect(readApiResponse(response)).rejects.toMatchObject({
			status: 502,
			message: expect.stringContaining('Restart the updated core'),
		});
	});
	it('keeps failure status for HTML proxy failures', async () => {
		await expect(
			readApiResponse(
				new Response('<html>Bad gateway</html>', { status: 503 }),
			),
		).rejects.toMatchObject({ status: 503 });
	});
	it('accepts JSON and reports both existing API error formats', async () => {
		expect(await readApiResponse(Response.json({ items: [] }))).toEqual({
			items: [],
		});
		for (const body of [
			{ error: 'Not authorized' },
			{ message: 'Not authorized' },
		])
			await expect(
				readApiResponse(Response.json(body, { status: 403 })),
			).rejects.toMatchObject({ status: 403, message: 'Not authorized' });
	});
	it('handles malformed JSON without exposing raw server content', async () => {
		await expect(
			readApiResponse(
				new Response('<!doctype html>', {
					headers: { 'content-type': 'application/json' },
				}),
			),
		).rejects.toMatchObject({
			status: 502,
			message: expect.stringContaining('invalid JSON'),
		});
	});
});
