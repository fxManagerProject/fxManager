/** biome-ignore-all lint/suspicious/noExplicitAny: fakes for gm/pm/repo are cast to satisfy handler options */
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';
import type { OnlinePlayer } from '@fxmanager/shared/types';

const dbPlayers = [
	{ id: 10, name: 'Alice', identifiers: { license: 'license:alice' } },
	{ id: 20, name: 'Bob', identifiers: { license: 'license:bob' } },
	{
		id: 30,
		name: 'Carol',
		identifiers: { license: 'license:carol', fivem: 'fivem:carol' },
	},
];

const onlinePlayer = (
	id: number,
	serverId: number,
	license: string,
): OnlinePlayer => ({
	id,
	serverId,
	name: `p${id}`,
	playtime: 0,
	identifiers: { license },
	isStaff: id === 10,
	firstSeen: new Date(0),
	lastSeen: new Date(0),
	health: 100,
});

const roster = [
	onlinePlayer(10, 1, 'license:alice'),
	onlinePlayer(20, 2, 'license:bob'),
];

const mockFindByLicense = mock(
	(license: string) =>
		dbPlayers.find((p) => p.identifiers.license === license) ?? null,
);
const mockFindByIdentifier = mock(
	(type: string, value: string) =>
		dbPlayers.find(
			(p) => (p.identifiers as Record<string, string>)[type] === value,
		) ?? null,
);
const mockFindById = mock(
	async (id: number) => dbPlayers.find((p) => p.id === id) ?? null,
);
const mockList = mock((page: number, pageSize: number, _opts: unknown) => ({
	items: dbPlayers,
	total: dbPlayers.length,
	page,
	pageSize,
}));
const mockAddBan = mock(
	async (playerId: number, _e: unknown, reason: string, _i: unknown) => ({
		id: 500,
		player: { id: playerId },
		reason,
	}),
);
const mockAddKick = mock(async (playerId: number, reason: string) => ({
	id: 600,
	player: { id: playerId },
	reason,
}));
const mockAddWarn = mock(async (playerId: number, reason: string) => ({
	id: 700,
	player: { id: playerId },
	reason,
}));
const mockUpdateNotes = mock(
	async (playerId: number, _adminId: number, content: string) => {
		if (content.trim().length <= 3) throw new Error('content_too_short');
		return { player: { id: playerId }, content };
	},
);
const mockBansSearch = mock((_opts: unknown) => [
	{
		id: 1,
		playerId: 10,
		name: 'Alice',
		reason: 'cheating',
		issuer: null,
		createdAt: new Date(0),
		expiresAt: null,
		revokedAt: null,
	},
]);
const mockBansRevoke = mock((id: number) =>
	id === 999 ? undefined : { id, playerId: 10 },
);
const mockRevokeWarn = mock((id: number) =>
	id === 999 ? undefined : { id, playerId: 10, reason: 'spam', issuer: null },
);
const mockRevokeKick = mock((id: number) =>
	id === 999 ? undefined : { id, playerId: 10, reason: 'afk', issuer: null },
);
const mockFindAdmin = mock((playerId: number) =>
	playerId === 10 ? { id: 4, username: 'FjamZoo' } : null,
);
const mockGetProfile = mock(async (adminId: number) =>
	adminId === 4
		? {
				id: 4,
				username: 'FjamZoo',
				// BAN (1<<1) | SERVER_ACTIONS (1<<11)
				effectivePermissions: 2 | 2048,
				group: {
					id: 1,
					name: 'Senior Admin',
					permissions: 2 | 2048,
					colour: '#ff0000',
					icon: null,
				},
			}
		: null,
);
const mockWhitelistAdd = mock((_data: unknown) => true as const);
const mockWhitelistRevoke = mock((value: string) =>
	value === 'license:missing' ? undefined : { id: 1, value },
);
const mockAuditLog = mock((_entry: unknown) => ({ id: 800 }));
const mockAuditList = mock(
	(
		page: number,
		pageSize: number,
		_action?: unknown,
		_target?: unknown,
		admins?: number[],
	) => ({
		items: [
			{
				id: 1,
				admin: 'FjamZoo',
				adminId: admins?.[0] ?? null,
				action: 'player.kick',
				playerId: 10,
				player: 'Alice',
				metadata: { source: 'ingame-api' },
				createdAt: new Date(0),
			},
		],
		total: 1,
		page,
		pageSize,
	}),
);

const fakeRepo = {
	players: {
		findByLicense: mockFindByLicense,
		findByIdentifier: mockFindByIdentifier,
		findById: mockFindById,
		list: mockList,
		addBan: mockAddBan,
		addKick: mockAddKick,
		addWarn: mockAddWarn,
		updatePlayerNotes: mockUpdateNotes,
		revokeWarn: mockRevokeWarn,
		revokeKick: mockRevokeKick,
	},
	bans: { search: mockBansSearch, revoke: mockBansRevoke },
	admins: { findByPlayerId: mockFindAdmin, getProfile: mockGetProfile },
	whitelist: { add: mockWhitelistAdd, revokeByValue: mockWhitelistRevoke },
	audit: { log: mockAuditLog, list: mockAuditList },
};

const mockEmit = mock(async (_event: string, _data: unknown) => {});
const dropPlayer = mock(async (_serverId: number, _msg: string) => ({
	success: true,
}));
const pmStart = mock(async () => true);
const pmStop = mock(async () => true);
const pmRestart = mock(async () => true);

mock.module('@fxmanager/database', () => ({ repo: fakeRepo }));
mock.module('../../modules/txadmin/compat', () => ({
	txAdminCompat: { emit: mockEmit },
}));

const { default: IngameModule } = await import('./ingame');
const { ConfigManager } = await import('../../modules/config/manager');

const token = ConfigManager.getInstance().getSystemValues().resourceApiToken;

const fakeGm = {
	getPlayerList: () => roster,
	getPlayer: (id: number) => roster.find((p) => p.id === id),
	dropPlayer,
} as any;
const fakePm = { start: pmStart, stop: pmStop, restart: pmRestart } as any;

describe('ingame API integration (HTTP)', () => {
	let app: FastifyInstance;

	const call = (
		method: 'GET' | 'POST',
		url: string,
		payload?: unknown,
		withToken = true,
	) =>
		app.inject({
			method,
			url: `/internal/ingame${url}`,
			headers: {
				'content-type': 'application/json',
				...(withToken ? { 'x-resource-token': token } : {}),
			},
			payload: payload as any,
		});

	beforeAll(async () => {
		app = Fastify();
		await app.register(IngameModule.handler, {
			prefix: '/internal/ingame',
			gm: fakeGm,
			pm: fakePm,
		} as any);
		await app.ready();
	});

	beforeEach(() => {
		for (const m of [
			mockFindByLicense,
			mockFindByIdentifier,
			mockFindById,
			mockList,
			mockAddBan,
			mockAddKick,
			mockAddWarn,
			mockUpdateNotes,
			mockBansSearch,
			mockBansRevoke,
			mockRevokeWarn,
			mockRevokeKick,
			mockFindAdmin,
			mockGetProfile,
			mockWhitelistAdd,
			mockWhitelistRevoke,
			mockAuditLog,
			mockAuditList,
			mockEmit,
			dropPlayer,
			pmStart,
			pmStop,
			pmRestart,
		])
			m.mockClear();
	});

	it('rejects requests without the resource token', async () => {
		const res = await call('GET', '/bans', undefined, false);
		expect(res.statusCode).toBe(401);
	});

	it('returns recent bans and passes the search query through', async () => {
		const recent = await call('GET', '/bans');
		expect(recent.statusCode).toBe(200);
		expect(recent.json()).toHaveLength(1);

		await call('GET', '/bans/search?q=cheat&page=2&pageSize=10');
		expect(mockBansSearch).toHaveBeenLastCalledWith({
			query: 'cheat',
			page: 2,
			pageSize: 10,
		});
	});

	it('returns the online player list for fetchPlayers', async () => {
		const res = await call('GET', '/players');
		expect(res.statusCode).toBe(200);
		expect(res.json()).toHaveLength(2);
		expect(res.json()[0].serverId).toBe(1);
	});

	describe('GET /self', () => {
		it('returns admin identity, group and resolved permission keys', async () => {
			// serverId 1 -> Alice (playerId 10) -> admin id 4
			const res = await call('GET', '/self?serverId=1');
			expect(res.statusCode).toBe(200);
			const body = res.json() as {
				isAdmin: boolean;
				isMaster: boolean;
				adminId: number | null;
				username: string | null;
				group: {
					id: number;
					name: string;
					colour: string;
					icon: string | null;
				} | null;
				permissions: string[];
			};
			expect(body.isAdmin).toBe(true);
			expect(body.isMaster).toBe(false);
			expect(body.adminId).toBe(4);
			expect(body.username).toBe('FjamZoo');
			expect(body.group).toEqual({
				id: 1,
				name: 'Senior Admin',
				colour: '#ff0000',
				icon: null,
			});
			expect(body.permissions).toEqual(['players.ban', 'control.server']);
		});

		it('returns isAdmin:false for an online non-admin', async () => {
			// serverId 2 -> Bob (playerId 20) -> not an admin
			const res = await call('GET', '/self?serverId=2');
			expect(res.statusCode).toBe(200);
			expect(res.json().isAdmin).toBe(false);
			expect(res.json().permissions).toEqual([]);
			expect(mockGetProfile).not.toHaveBeenCalled();
		});

		it('404s when the server id is not online', async () => {
			const res = await call('GET', '/self?serverId=999');
			expect(res.statusCode).toBe(404);
		});

		it('400s on a missing server id', async () => {
			const res = await call('GET', '/self');
			expect(res.statusCode).toBe(400);
		});
	});

	it('looks up a player by server id and 404s an unknown one', async () => {
		const ok = await call('GET', '/players/lookup?serverId=1');
		expect(ok.statusCode).toBe(200);
		expect(ok.json().id).toBe(10);

		const missing = await call('GET', '/players/lookup?serverId=99');
		expect(missing.statusCode).toBe(404);
	});

	it('looks up an offline player by a non-license identifier', async () => {
		const res = await call('GET', '/players/lookup?fivem=fivem:carol');
		expect(res.statusCode).toBe(200);
		expect(res.json().id).toBe(30);
		expect(mockFindByIdentifier).toHaveBeenCalledWith('fivem', 'fivem:carol');
	});

	it('searches the full player DB with paging/sort', async () => {
		const res = await call(
			'GET',
			'/players/search?q=ali&page=1&sortBy=playtime',
		);
		expect(res.statusCode).toBe(200);
		expect(mockList).toHaveBeenLastCalledWith(1, 50, {
			search: 'ali',
			sortBy: 'playtime',
			sortOrder: undefined,
		});
	});

	it('bans an online player, attributing the acting admin and dropping them', async () => {
		const res = await call('POST', '/bans', {
			target: 2,
			reason: 'aimbot',
			by: 1,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json() as any).toEqual({ banId: 500 });
		// resolved player 20, permanent, issuer = admin 4 (from acting netId 1)
		expect(mockAddBan).toHaveBeenCalledWith(20, null, 'aimbot', 4);
		expect(dropPlayer).toHaveBeenCalledTimes(1);
		expect(dropPlayer.mock.calls[0]?.[0]).toBe(2);
		expect(mockAuditLog).toHaveBeenCalledTimes(1);
		expect(mockAuditLog.mock.calls[0]?.[0]).toMatchObject({
			adminId: 4,
			action: 'player.ban',
		});
		expect(mockEmit).toHaveBeenCalledTimes(1);
	});

	it('bans an offline player by identifiers without dropping', async () => {
		const res = await call('POST', '/bans', {
			target: { identifiers: { license: 'license:carol' } },
			reason: 'evasion',
		});
		expect(res.statusCode).toBe(200);
		expect(mockAddBan).toHaveBeenCalledWith(30, null, 'evasion', null);
		expect(dropPlayer).not.toHaveBeenCalled();
	});

	it('409s when a longer active ban already exists', async () => {
		mockAddBan.mockResolvedValueOnce(false as any);
		const res = await call('POST', '/bans', { target: 2, reason: 'x' });
		expect(res.statusCode).toBe(409);
		expect(res.json().message).toBe('active_longer_ban_exists');
	});

	it('404s a ban whose target cannot be resolved', async () => {
		const res = await call('POST', '/bans', {
			target: { identifiers: { license: 'license:ghost' } },
			reason: 'x',
		});
		expect(res.statusCode).toBe(404);
	});

	it('revokes a ban and emits actionRevoked', async () => {
		const res = await call('POST', '/bans/5/revoke', { by: 1 });
		expect(res.statusCode).toBe(200);
		expect(res.json() as any).toEqual({ banId: 5 });
		expect(mockBansRevoke).toHaveBeenCalledWith(5);
		expect(mockAuditLog.mock.calls[0]?.[0]).toMatchObject({
			adminId: 4,
			action: 'player.unban',
			playerId: 10,
		});
		expect(mockEmit).toHaveBeenCalledTimes(1);
		expect(mockEmit.mock.calls[0]?.[1]).toMatchObject({ actionType: 'ban' });
	});

	it('404s revoking a ban that does not exist', async () => {
		const res = await call('POST', '/bans/999/revoke', {});
		expect(res.statusCode).toBe(404);
		expect(res.json().message).toBe('ban_not_found');
		expect(mockEmit).not.toHaveBeenCalled();
	});

	it('revokes a warn and emits actionRevoked', async () => {
		const res = await call('POST', '/warns/6/revoke', { by: 1 });
		expect(res.statusCode).toBe(200);
		expect(res.json() as any).toEqual({ warnId: 6 });
		expect(mockRevokeWarn).toHaveBeenCalledWith(6);
		expect(mockAuditLog.mock.calls[0]?.[0]).toMatchObject({
			adminId: 4,
			action: 'player.unwarn',
			playerId: 10,
		});
		expect(mockEmit.mock.calls[0]?.[1]).toMatchObject({ actionType: 'warn' });
	});

	it('404s revoking a warn that does not exist', async () => {
		const res = await call('POST', '/warns/999/revoke', {});
		expect(res.statusCode).toBe(404);
		expect(res.json().message).toBe('warn_not_found');
		expect(mockEmit).not.toHaveBeenCalled();
	});

	it('revokes a kick and emits actionRevoked', async () => {
		const res = await call('POST', '/kicks/7/revoke', { by: 1 });
		expect(res.statusCode).toBe(200);
		expect(res.json() as any).toEqual({ kickId: 7 });
		expect(mockRevokeKick).toHaveBeenCalledWith(7);
		expect(mockAuditLog.mock.calls[0]?.[0]).toMatchObject({
			adminId: 4,
			action: 'player.unkick',
			playerId: 10,
		});
		expect(mockEmit.mock.calls[0]?.[1]).toMatchObject({ actionType: 'kick' });
	});

	it('404s revoking a kick that does not exist', async () => {
		const res = await call('POST', '/kicks/999/revoke', {});
		expect(res.statusCode).toBe(404);
		expect(res.json().message).toBe('kick_not_found');
		expect(mockEmit).not.toHaveBeenCalled();
	});

	it('kicks an online player and 409s an offline target', async () => {
		const ok = await call('POST', '/kick', { target: 2, reason: 'afk' });
		expect(ok.statusCode).toBe(200);
		expect(mockAddKick).toHaveBeenCalledWith(20, 'afk', null);
		expect(dropPlayer).toHaveBeenCalledTimes(1);

		const offline = await call('POST', '/kick', {
			target: { playerId: 30 },
			reason: 'afk',
		});
		expect(offline.statusCode).toBe(409);
		expect(offline.json().message).toBe('not_online');
	});

	it('warns a player and emits the compat event', async () => {
		const res = await call('POST', '/warn', {
			target: 2,
			reason: 'lang',
			by: 1,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json() as any).toEqual({ warnId: 700 });
		expect(mockAddWarn).toHaveBeenCalledWith(20, 'lang', 4);
		expect(mockEmit).toHaveBeenCalledTimes(1);
	});

	it('requires an actor for notes and saves when one resolves', async () => {
		const noActor = await call('POST', '/notes', {
			target: 2,
			content: 'suspicious player',
		});
		expect(noActor.statusCode).toBe(400);
		expect(noActor.json().message).toBe('actor_required');

		const ok = await call('POST', '/notes', {
			target: 2,
			content: 'suspicious player',
			by: 1,
		});
		expect(ok.statusCode).toBe(200);
		expect(mockUpdateNotes).toHaveBeenCalledWith(20, 4, 'suspicious player');

		const short = await call('POST', '/notes', {
			target: 2,
			content: 'ab',
			by: 1,
		});
		expect(short.statusCode).toBe(400);
		expect(short.json().message).toBe('content_too_short');
	});

	it('whitelists an identifier (prefixing the value) and reports conflicts', async () => {
		const ok = await call('POST', '/whitelist', {
			type: 'license',
			value: 'abc123',
		});
		expect(ok.statusCode).toBe(200);
		expect(mockWhitelistAdd).toHaveBeenCalledWith({
			type: 'license',
			value: 'license:abc123',
			adminId: undefined,
		});

		mockWhitelistAdd.mockImplementationOnce(() => {
			throw new Error('already_whitelisted');
		});
		const dup = await call('POST', '/whitelist', {
			type: 'license',
			value: 'abc123',
		});
		expect(dup.statusCode).toBe(400);
		expect(dup.json().message).toBe('already_whitelisted');
	});

	it('removes a whitelist entry by value and 404s a missing one', async () => {
		const ok = await call('POST', '/whitelist/remove', {
			type: 'license',
			value: 'abc123',
		});
		expect(ok.statusCode).toBe(200);
		expect(mockWhitelistRevoke).toHaveBeenCalledWith('license:abc123');

		const missing = await call('POST', '/whitelist/remove', {
			type: 'license',
			value: 'missing',
		});
		expect(missing.statusCode).toBe(404);
	});

	it('runs server control and surfaces failures', async () => {
		const ok = await call('POST', '/server/restart', { by: 1 });
		expect(ok.statusCode).toBe(200);
		expect(ok.json() as any).toEqual({ success: true });
		expect(pmRestart).toHaveBeenCalledTimes(1);
		expect(mockAuditLog.mock.calls[0]?.[0]).toMatchObject({
			adminId: 4,
			action: 'server.restart',
		});

		pmStart.mockResolvedValueOnce(false);
		const failed = await call('POST', '/server/start', {});
		expect(failed.statusCode).toBe(500);
		expect(failed.json().message).toBe('server_action_failed');
	});

	it('records a custom action recap under the acting admin', async () => {
		const res = await call('POST', '/recap', {
			serverId: 1,
			label: 'freeze',
			target: 2,
			metadata: { seconds: 60 },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json() as any).toEqual({ recapId: 800 });
		expect(mockAuditLog).toHaveBeenCalledTimes(1);
		expect(mockAuditLog.mock.calls[0]?.[0]).toMatchObject({
			adminId: 4,
			action: 'custom.action',
			playerId: 20,
			metadata: {
				label: 'freeze',
				seconds: 60,
				source: 'ingame-api',
			},
		});
	});

	it('records a custom action recap without a target', async () => {
		const res = await call('POST', '/recap', {
			serverId: 1,
			label: 'announce',
		});
		expect(res.statusCode).toBe(200);
		expect(mockAuditLog.mock.calls[0]?.[0]).toMatchObject({
			adminId: 4,
			action: 'custom.action',
			metadata: { label: 'announce', source: 'ingame-api' },
		});
		expect((mockAuditLog.mock.calls[0]?.[0] as any).playerId).toBeUndefined();
	});

	it('requires the acting admin to resolve for a custom recap', async () => {
		const res = await call('POST', '/recap', { serverId: 2, label: 'freeze' });
		expect(res.statusCode).toBe(400);
		expect(res.json().message).toBe('actor_required');
		expect(mockAuditLog).not.toHaveBeenCalled();
	});

	it('rejects a custom recap with a missing or malformed label', async () => {
		const missing = await call('POST', '/recap', { serverId: 1 });
		expect(missing.statusCode).toBe(400);
		expect(missing.json().message).toBe('invalid_label');

		const bad = await call('POST', '/recap', {
			serverId: 1,
			label: 'NOT VALID!',
		});
		expect(bad.statusCode).toBe(400);
		expect(bad.json().message).toBe('invalid_label');

		expect(mockAuditLog).not.toHaveBeenCalled();
	});

	it('fetches an action recap by admin id', async () => {
		const res = await call('GET', '/recap?adminId=4');
		expect(res.statusCode).toBe(200);
		expect(mockAuditList).toHaveBeenCalledWith(
			1,
			50,
			undefined,
			undefined,
			[4],
		);
		expect(res.json().items).toHaveLength(1);
		expect(res.json().total).toBe(1);
	});

	it('fetches an action recap by acting server id with paging', async () => {
		const res = await call('GET', '/recap?serverId=1&page=2&pageSize=10');
		expect(res.statusCode).toBe(200);
		expect(mockAuditList).toHaveBeenCalledWith(
			2,
			10,
			undefined,
			undefined,
			[4],
		);
	});

	it('400s an action recap lookup with no resolvable admin', async () => {
		const res = await call('GET', '/recap');
		expect(res.statusCode).toBe(400);
		expect(res.json().message).toBe('admin_required');
		expect(mockAuditList).not.toHaveBeenCalled();
	});
});
