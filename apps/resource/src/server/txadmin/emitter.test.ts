import { afterEach, expect, test } from 'bun:test';
import { emitTxEvent } from './emitter';

type Globalish = Record<string, unknown>;
const originalEmit = (globalThis as Globalish).emit;

afterEach(() => {
	(globalThis as Globalish).emit = originalEmit;
});

test('emitTxEvent emits the prefixed txAdmin event name with the payload', () => {
	const calls: Array<[string, unknown]> = [];
	(globalThis as Globalish).emit = (name: string, data: unknown) => {
		calls.push([name, data]);
	};

	const payload = { delay: 1000, author: 'admin', message: 'Restarting' };
	emitTxEvent('serverShuttingDown', payload);

	expect(calls).toHaveLength(1);
	expect(calls[0]?.[0]).toBe('txAdmin:events:serverShuttingDown');
	expect(calls[0]?.[1]).toEqual(payload);
});

test('emitTxEvent forwards player event payloads untouched', () => {
	const calls: Array<[string, unknown]> = [];
	(globalThis as Globalish).emit = (name: string, data: unknown) => {
		calls.push([name, data]);
	};

	const payload = {
		target: 3,
		author: 'admin',
		reason: 'rule break',
		dropMessage: 'You were kicked',
	};
	emitTxEvent('playerKicked', payload);

	expect(calls[0]?.[0]).toBe('txAdmin:events:playerKicked');
	expect(calls[0]?.[1]).toEqual(payload);
});
