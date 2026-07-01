import { afterEach, expect, test } from 'bun:test';
import { handleTxEvent, txEventSchema } from './handler';

type Globalish = Record<string, unknown>;
const originalEmit = (globalThis as Globalish).emit;

afterEach(() => {
	(globalThis as Globalish).emit = originalEmit;
});

test('handleTxEvent emits the event and returns a success response', () => {
	const calls: Array<[string, unknown]> = [];
	(globalThis as Globalish).emit = (name: string, data: unknown) => {
		calls.push([name, data]);
	};

	const res = handleTxEvent({
		event: 'announcement',
		data: { author: 'admin', message: 'hi' },
	});

	expect(calls[0]?.[0]).toBe('txAdmin:events:announcement');
	expect(res.status).toBe(200);
	expect(res.body).toEqual({ success: true, data: null });
});

test('txEventSchema accepts a known event name', () => {
	const result = txEventSchema.safeParse({
		event: 'serverShuttingDown',
		data: { delay: 1000, author: 'admin', message: 'bye' },
	});
	expect(result.success).toBe(true);
});

test('txEventSchema rejects an unknown event name', () => {
	const result = txEventSchema.safeParse({ event: 'notATxEvent', data: {} });
	expect(result.success).toBe(false);
});
