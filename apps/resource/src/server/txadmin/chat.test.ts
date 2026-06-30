import { expect, test } from 'bun:test';

type Globalish = Record<string, unknown>;
const g = globalThis as Globalish;

const handlers: Record<string, (data: unknown) => void> = {};
g.on = (event: string, cb: (data: unknown) => void) => {
	handlers[event] = cb;
};

await import('./chat');

type ChatArgs = [string, number, { color: number[]; args: string[] }];

test('scheduledRestart posts the translatedMessage to chat', () => {
	const sent: ChatArgs[] = [];
	g.emitNet = (...args: ChatArgs) => sent.push(args);

	handlers['txAdmin:events:scheduledRestart']?.({
		secondsRemaining: 300,
		translatedMessage: 'Server restarting in 5 minutes',
	});

	expect(sent[0]?.[0]).toBe('chat:addMessage');
	expect(sent[0]?.[1]).toBe(-1);
	expect(sent[0]?.[2].args).toEqual([
		'fxManager',
		'Server restarting in 5 minutes',
	]);
});

test('scheduledRestartSkipped posts a cancellation message naming the author', () => {
	const sent: ChatArgs[] = [];
	g.emitNet = (...args: ChatArgs) => sent.push(args);

	handlers['txAdmin:events:scheduledRestartSkipped']?.({
		secondsRemaining: 100,
		temporary: true,
		author: 'admin',
	});

	expect(sent[0]?.[2].args).toEqual([
		'fxManager',
		'Scheduled restart cancelled by admin',
	]);
});
