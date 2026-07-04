/** biome-ignore-all lint/suspicious/noExplicitAny: fakes for gm/repo/admin are cast to satisfy handler options */
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { UserPermissions } from '@fxmanager/shared/constants';

let currentAdmin = { id: 1, username: 'Tester', permissions: 0 };

const activeBan = { id: 5, playerId: 10, reason: 'cheating', issuer: 7 };
const activeWarn = {
	id: 6,
	playerId: 10,
	reason: 'spam',
	issuer: 7,
	revoked: 1,
};
const activeKick = { id: 7, playerId: 10, reason: 'afk', issuer: null, revoked: 1 };

const scopedRow = <T extends { id: number; playerId: number }>(
	row: T,
	id: number,
	playerId?: number,
) =>
	id === row.id && (playerId === undefined || playerId === row.playerId)
		? { ...row }
		: undefined;

const mockBansRevoke = mock((id: number, playerId?: number) =>
	scopedRow(activeBan, id, playerId),
);
const mockRevokeWarn = mock((id: number, playerId?: number) =>
	scopedRow(activeWarn, id, playerId),
);
const mockRevokeKick = mock((id: number, playerId?: number) =>
	scopedRow(activeKick, id, playerId),
);
const mockFindById = mock(async (id: number) =>
	id === 10
		? { id: 10, name: 'BadGuy', identifiers: { license: 'license:abc' } }
		: null,
);
const mockAdminFindById = mock((id: number) =>
	id === 7 ? { id: 7, username: 'OriginalAdmin' } : null,
);
const mockAuditLog = mock((_entry: unknown) => {});

const fakeRepo = {
	players: {
		findById: mockFindById,
		revokeWarn: mockRevokeWarn,
		revokeKick: mockRevokeKick,
	},
	bans: { revoke: mockBansRevoke },
	admins: { findById: mockAdminFindById },
	audit: { log: mockAuditLog },
};

const mockEmit = mock(async () => {});

mock.module('@fxmanager/database', () => ({ repo: fakeRepo }));
mock.module('../../modules/txadmin/compat', () => ({
	txAdminCompat: { emit: mockEmit },
}));
mock.module('../../middleware/session', () => ({
	sessionAuth: async (req: any) => {
		req.admin = currentAdmin;
	},
}));

const { default: PlayersModule } = await import('./players');

const fakeGm = { getPlayer: () => undefined } as any;

describe('players revoke endpoint (HTTP)', () => {
	let app: FastifyInstance;

	const revoke = (playerId: number, body: unknown) =>
		app.inject({
			method: 'POST',
			url: `/players/${playerId}/revoke`,
			headers: { 'content-type': 'application/json' },
			payload: body as any,
		});

	beforeAll(async () => {
		app = Fastify();
		await app.register(PlayersModule.handler, {
			prefix: '/players',
			gm: fakeGm,
		} as any);
		await app.ready();
	});

	beforeEach(() => {
		currentAdmin = { id: 1, username: 'Tester', permissions: 0 };
		for (const m of [
			mockBansRevoke,
			mockRevokeWarn,
			mockRevokeKick,
			mockFindById,
			mockAdminFindById,
			mockAuditLog,
			mockEmit,
		])
			m.mockClear();
	});

	it('rejects a revoke when the admin lacks the matching permission', async () => {
		currentAdmin.permissions = UserPermissions.BAN; // has BAN, not REVOKE_BAN
		const res = await revoke(10, { type: 'ban', id: activeBan.id });

		expect(res.statusCode).toBe(403);
		expect(mockBansRevoke).not.toHaveBeenCalled();
		expect(mockEmit).not.toHaveBeenCalled();
	});

	it('rejects an invalid action type', async () => {
		currentAdmin.permissions = UserPermissions.MASTER;
		const res = await revoke(10, { type: 'nope', id: 1 });

		expect(res.statusCode).toBe(400);
	});

	it('rejects a non-integer action id', async () => {
		currentAdmin.permissions = UserPermissions.MASTER;
		const res = await revoke(10, { type: 'ban', id: 'abc' });

		expect(res.statusCode).toBe(400);
	});

	it('returns 404 when the action does not exist or is already revoked', async () => {
		currentAdmin.permissions = UserPermissions.REVOKE_BAN;
		const res = await revoke(10, { type: 'ban', id: 999 });

		expect(res.statusCode).toBe(404);
		expect(mockAuditLog).not.toHaveBeenCalled();
		expect(mockEmit).not.toHaveBeenCalled();
	});

	it('returns 404 without mutating when the action does not belong to the path player', async () => {
		currentAdmin.permissions = UserPermissions.REVOKE_BAN;
		const res = await revoke(99, { type: 'ban', id: activeBan.id });

		expect(res.statusCode).toBe(404);
		// scope is passed to the DB so the mismatch revokes nothing
		expect(mockBansRevoke).toHaveBeenCalledWith(activeBan.id, 99);
		expect(mockAuditLog).not.toHaveBeenCalled();
		expect(mockEmit).not.toHaveBeenCalled();
	});

	it('revokes a ban: logs player.unban and emits actionRevoked', async () => {
		currentAdmin.permissions = UserPermissions.REVOKE_BAN;
		const res = await revoke(10, { type: 'ban', id: activeBan.id });

		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ success: true, data: null });
		expect(mockBansRevoke).toHaveBeenCalledWith(activeBan.id, 10);

		expect(mockAuditLog).toHaveBeenCalledTimes(1);
		expect(mockAuditLog).toHaveBeenCalledWith(
			expect.objectContaining({
				adminId: 1,
				action: 'player.unban',
				playerId: 10,
				metadata: { banId: activeBan.id },
			}),
		);

		expect(mockEmit).toHaveBeenCalledTimes(1);
		expect(mockEmit).toHaveBeenCalledWith(
			'actionRevoked',
			expect.objectContaining({
				actionId: String(activeBan.id),
				actionType: 'ban',
				actionReason: 'cheating',
				actionAuthor: 'OriginalAdmin',
				playerName: 'BadGuy',
				playerIds: ['license:abc'],
				playerHwids: [],
				revokedBy: 'Tester',
			}),
		);
	});

	it('revokes a warn: logs player.unwarn', async () => {
		currentAdmin.permissions = UserPermissions.REVOKE_WARN;
		const res = await revoke(10, { type: 'warn', id: activeWarn.id });

		expect(res.statusCode).toBe(200);
		expect(mockRevokeWarn).toHaveBeenCalledWith(activeWarn.id, 10);
		expect(mockAuditLog).toHaveBeenCalledWith(
			expect.objectContaining({
				action: 'player.unwarn',
				metadata: { warnId: activeWarn.id },
			}),
		);
		expect(mockEmit).toHaveBeenCalledWith(
			'actionRevoked',
			expect.objectContaining({ actionType: 'warn' }),
		);
	});

	it('revokes a kick: logs player.unkick and tolerates a missing original issuer', async () => {
		currentAdmin.permissions = UserPermissions.REVOKE_KICK;
		const res = await revoke(10, { type: 'kick', id: activeKick.id });

		expect(res.statusCode).toBe(200);
		expect(mockRevokeKick).toHaveBeenCalledWith(activeKick.id, 10);
		expect(mockAdminFindById).not.toHaveBeenCalled(); // issuer was null
		expect(mockEmit).toHaveBeenCalledWith(
			'actionRevoked',
			expect.objectContaining({ actionType: 'kick', actionAuthor: '' }),
		);
	});

	it('does not let REVOKE_BAN authorize a warn revocation', async () => {
		currentAdmin.permissions = UserPermissions.REVOKE_BAN;
		const res = await revoke(10, { type: 'warn', id: activeWarn.id });

		expect(res.statusCode).toBe(403);
		expect(mockRevokeWarn).not.toHaveBeenCalled();
	});
});
