import { afterEach, expect, mock, test } from 'bun:test';
import { UserPermissions } from '@fxmanager/shared/constants';
const registrations = new Map<
	string,
	{
		handler: (source: number, payload: unknown) => Promise<unknown>;
		options: { permission: string };
	}
>();
let permissions = UserPermissions.MASTER;
let request: unknown;
let fail = false;
let online: { id: number; serverId: number; name: string }[] = [];
let matches: { id: number; name: string; lastSeen?: string }[] = [];
mock.module('../../utils/callbacks', () => ({
	ServerCallbacks: {
		register: (
			name: string,
			handler: (source: number, payload: unknown) => Promise<unknown>,
			options: { permission: string },
		) => registrations.set(name, { handler, options }),
	},
}));
mock.module('../../utils/permissions', () => ({
	getPermissions: () => permissions,
}));
mock.module('../../utils/query', () => ({
	QueryManager: async (input: unknown) => {
		request = input;
		if (fail) throw new Error('Core unavailable');
		return (input as { endpoint: string }).endpoint.includes('/players/search')
			? { items: matches }
			: online;
	},
}));
Object.assign(globalThis, {
	on: () => {},
	GetPlayerName: () => 'Online player',
	GetCurrentResourceName: () => 'fxmanager',
	GetPlayerPed: () => 0,
	GetPlayerPing: () => 12,
	GetPlayerRoutingBucket: () => 0,
});
await import('./index');
const action = () =>
	registrations.get('player-action')!.handler(1, {
		target: 12,
		playerId: 44,
		action: 'warn',
		reason: '  Rule violation  ',
		by: 99,
	});
afterEach(() => {
	permissions = UserPermissions.MASTER;
	request = undefined;
	fail = false;
	online = [];
	matches = [];
});
test('both roster and actions require server-side monitoring permission', () => {
	expect(registrations.get('list-players')!.options.permission).toBe(
		'PLAYER_MONITORING',
	);
	expect(registrations.get('player-action')!.options.permission).toBe(
		'PLAYER_MONITORING',
	);
});
test('monitoring permission alone cannot perform moderation', async () => {
	permissions = UserPermissions.PLAYER_MONITORING;
	expect(await action()).toMatchObject({ success: false });
	expect(request).toBeUndefined();
});
test('uses stable player identity and the actual event sender as issuer', async () => {
	expect(await action()).toMatchObject({ success: true });
	expect(request).toMatchObject({
		endpoint: '/ingame/warn',
		method: 'POST',
		body: { target: { playerId: 44 }, reason: 'Rule violation', by: 1 },
	});
});
test('core failure is returned without claiming success', async () => {
	fail = true;
	expect(await action()).toEqual({
		success: false,
		message: 'Core unavailable',
	});
	fail = false;
	expect(await action()).toMatchObject({ success: true });
});

test('search merges offline records with online state without duplicating players', async () => {
	online = [{ id: 44, serverId: 12, name: 'Alex' }];
	matches = [
		{ id: 44, name: 'Alex' },
		{ id: 55, name: 'Alex offline' },
		{ id: 56, name: 'Alex older' },
	];
	const result = await registrations
		.get('list-players')!
		.handler(1, { query: 'Alex & friend' });
	expect(result).toEqual([
		{
			playerId: 44,
			serverId: 12,
			name: 'Alex',
			online: true,
			ping: 12,
			bucket: 0,
		},
		{ playerId: 55, serverId: 0, name: 'Alex offline', online: false, ping: 0 },
		{ playerId: 56, serverId: 0, name: 'Alex older', online: false, ping: 0 },
	]);
	expect(request).toMatchObject({
		endpoint: '/ingame/players/search?q=Alex%20%26%20friend&pageSize=50',
	});
});
test('rejects invalid searches before calling core', async () => {
	for (const query of [7, 'a'.repeat(101)])
		expect(
			await registrations.get('list-players')!.handler(1, { query }),
		).toBeNull();
	expect(request).toBeUndefined();
});
test('warns and bans offline players by database ID but refuses offline kicks', async () => {
	const handler = registrations.get('player-action')!.handler;
	for (const action of ['warn', 'ban'])
		expect(
			await handler(1, {
				target: 0,
				playerId: 55,
				action,
				reason: 'Rule violation',
			}),
		).toMatchObject({ success: true });
	request = undefined;
	expect(
		await handler(1, {
			target: 0,
			playerId: 55,
			action: 'kick',
			reason: 'Rule violation',
		}),
	).toMatchObject({ success: false });
	expect(request).toBeUndefined();
});

test('matches an online server ID even when database search has no matches', async () => {
	online = [{ id: 44, serverId: 12, name: 'Alex' }];
	expect(
		await registrations.get('list-players')!.handler(1, { query: '12' }),
	).toMatchObject([{ playerId: 44, serverId: 12, online: true }]);
});

test('online scope filters connections without querying player history', async () => {
	online = [
		{ id: 44, serverId: 12, name: 'Alex' },
		{ id: 45, serverId: 13, name: 'Blair' },
	];
	expect(
		await registrations
			.get('list-players')!
			.handler(1, { scope: 'online', query: 'Alex' }),
	).toMatchObject([{ playerId: 44, online: true }]);
	expect(request).toMatchObject({ endpoint: '/ingame/players' });
});
test('all scope browses recent offline records without a search and includes last seen', async () => {
	matches = [
		{ id: 55, name: 'Offline player', lastSeen: '2026-10-25T14:30:00.000Z' },
	];
	expect(
		await registrations
			.get('list-players')!
			.handler(1, { scope: 'all', query: '' }),
	).toMatchObject([
		{
			playerId: 55,
			online: false,
			lastSeen: Date.parse('2026-10-25T14:30:00.000Z'),
		},
	]);
	expect(request).toMatchObject({
		endpoint: '/ingame/players/search?q=&pageSize=50',
	});
});
test('rejects unsupported scopes before calling core', async () => {
	expect(
		await registrations
			.get('list-players')!
			.handler(1, { scope: 'unexpected' }),
	).toBeNull();
	expect(request).toBeUndefined();
});
