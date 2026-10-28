import { expect, mock, test } from 'bun:test';
const server = Bun.serve({
	hostname: '127.0.0.1',
	port: 0,
	fetch: () => new Promise<Response>(() => {}),
});
mock.module('./env', () => ({
	API_TOKEN: 'test-token',
	HOSTNAME: `127.0.0.1:${server.port}`,
}));
const { QueryManager } = await import('./query');
test('aborts an HTTP request when the core stops responding', async () => {
	const errorLog = mock(() => {});
	const original = console.error;
	console.error = errorLog;
	try {
		await expect(
			QueryManager({
				endpoint: '/stalled',
				method: 'POST',
				signal: AbortSignal.timeout(20),
			}),
		).rejects.toThrow(/abort|timed out/i);
	} finally {
		console.error = original;
		server.stop(true);
	}
});
