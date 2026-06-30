import { afterEach, expect, test } from 'bun:test';

type Globalish = Record<string, unknown>;
const g = globalThis as Globalish;

g.GetConvar = (key: string, def: string) =>
	key === 'resource-api-token' ? '00000000-0000-4000-8000-000000000000' : def;
g.GetConvarInt = (_key: string, def: number) => def;

const { playerManager } = await import('./players');

type WithPlayers = { players: Map<string, unknown> };
const setPlayers = (entries: string[]) => {
	(playerManager as unknown as WithPlayers).players = new Map(
		entries.map((id) => [id, { permissions: 0 }]),
	);
};

const originalDropPlayer = g.DropPlayer;
afterEach(() => {
	g.DropPlayer = originalDropPlayer;
	setPlayers([]);
});

test('dropAll disconnects every tracked player with the reason', () => {
	setPlayers(['1', '2', '3']);
	const drops: Array<[string, string]> = [];
	g.DropPlayer = (id: string, reason: string) => drops.push([id, reason]);

	const count = playerManager.dropAll('Server is restarting.');

	expect(count).toBe(3);
	expect(drops).toEqual([
		['1', 'Server is restarting.'],
		['2', 'Server is restarting.'],
		['3', 'Server is restarting.'],
	]);
});

test('dropAll returns 0 when nobody is connected', () => {
	setPlayers([]);
	const drops: string[] = [];
	g.DropPlayer = (id: string) => drops.push(id);

	expect(playerManager.dropAll('bye')).toBe(0);
	expect(drops).toEqual([]);
});
