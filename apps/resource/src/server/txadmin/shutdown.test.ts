import { expect, spyOn, test } from 'bun:test';

type Globalish = Record<string, unknown>;
const g = globalThis as Globalish;

g.GetConvar = (key: string, def: string) =>
	key === 'resource-api-token' ? '00000000-0000-4000-8000-000000000000' : def;
g.GetConvarInt = (_key: string, def: number) => def;

const handlers: Record<string, (data: unknown) => void> = {};
g.on = (event: string, cb: (data: unknown) => void) => {
	handlers[event] = cb;
};

const { playerManager } = await import('../monitoring');
await import('./shutdown');

test('serverShuttingDown disconnects everyone with the message', () => {
	const spy = spyOn(playerManager, 'dropAll').mockReturnValue(0);

	handlers['txAdmin:events:serverShuttingDown']?.({ message: 'Restarting' });

	expect(spy).toHaveBeenCalledWith('Restarting');
	spy.mockRestore();
});

test('serverShuttingDown falls back to a default reason', () => {
	const spy = spyOn(playerManager, 'dropAll').mockReturnValue(0);

	handlers['txAdmin:events:serverShuttingDown']?.({});

	expect(spy).toHaveBeenCalledWith('Server is shutting down.');
	spy.mockRestore();
});
