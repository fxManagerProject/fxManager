import { expect, test } from 'bun:test';
import { EVENT_NAMES } from '@common/types';
const listeners = new Map<string, (response: unknown) => void>();
const sent: Array<{ requestId: string }> = [];
Object.assign(globalThis, {
	on: () => {},
	GetPlayerIdentifierByType: () => 'license:test',
	onNet: (name: string, handler: (response: unknown) => void) =>
		listeners.set(name, handler),
	emitNet: (_event: string, _target: number, request: { requestId: string }) =>
		sent.push(request),
});
const { ServerCallbackManager } = await import('./callbacks');
test('concurrent callbacks use distinct IDs and reject replies from another player', async () => {
	const manager = new ServerCallbackManager();
	const first = manager.trigger(12, 'test', null, { timeoutMs: 100 });
	const second = manager.trigger(13, 'test', null, { timeoutMs: 100 });
	expect(sent[0]!.requestId).not.toBe(sent[1]!.requestId);
	const receive = listeners.get(EVENT_NAMES.SERVER_TO_CLIENT_RES)!;
	Object.assign(globalThis, { source: 99 });
	receive({ requestId: sent[0]!.requestId, success: true, data: 'forged' });
	Object.assign(globalThis, { source: 12 });
	receive({ requestId: sent[0]!.requestId, success: true, data: 'first' });
	Object.assign(globalThis, { source: 13 });
	receive({ requestId: sent[1]!.requestId, success: true, data: 'second' });
	expect(await first).toBe('first');
	expect(await second).toBe('second');
});

test('ignores malformed network envelopes', async () => {
	new ServerCallbackManager();
	for (const value of [null, undefined, 5, {}, { name: 4, requestId: [] }]) {
		await listeners.get(EVENT_NAMES.CLIENT_TO_SERVER_REQ)!(value);
		listeners.get(EVENT_NAMES.SERVER_TO_CLIENT_RES)!(value);
	}
});

test('bounds concurrent work and suppresses results after identity changes', async () => {
	let license = 'license:original';
	Object.assign(globalThis, {
		source: 45,
		GetPlayerIdentifierByType: () => license,
	});
	const manager = new ServerCallbackManager();
	let finish!: (value: string) => void;
	let count = 0;
	const waiting = new Promise<string>((resolve) => {
		finish = resolve;
	});
	manager.register('slow', () => {
		count++;
		return waiting;
	});
	const receive = listeners.get(EVENT_NAMES.CLIENT_TO_SERVER_REQ)!;
	const requests = Array.from({ length: 12 }, (_, i) =>
		receive({ name: 'slow', requestId: String(i) }),
	);
	expect(count).toBe(8);
	const before = sent.length;
	license = 'license:replacement';
	finish('private');
	await Promise.all(requests);
	expect(sent.length).toBe(before);
});
