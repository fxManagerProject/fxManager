/** biome-ignore-all lint/suspicious/noExplicitAny: fakes for gm/repo/admin are cast to satisfy handler options */
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';

let currentAdmin = { id: 1, username: 'Tester', permissions: 0 };
let authed = true;

const activityPayload = {
	from: '2026-06-06',
	to: '2026-07-05',
	days: [
		{ date: '2026-07-01', playtimeMs: 3_600_000, sessionCount: 2 },
		{ date: '2026-07-03', playtimeMs: 1_800_000, sessionCount: 1 },
	],
	summary: {
		daysActive: 2,
		totalPlaytimeMs: 5_400_000,
		longestSessionMs: 3_600_000,
		avgSessionMs: 1_800_000,
	},
};

const sessionsPage = {
	items: [
		{
			id: 3,
			connectedAt: 3000,
			disconnectedAt: 4000,
			durationMs: 1000,
			endReason: 'quit',
		},
		{
			id: 2,
			connectedAt: 2000,
			disconnectedAt: 2500,
			durationMs: 500,
			endReason: 'crash',
		},
	],
	total: 3,
	page: 1,
	pageSize: 2,
};

const mockGetRangeActivity = mock(
	(_playerId: number, _from: Date, _to: Date) => activityPayload,
);
const mockListSessions = mock(
	(_playerId: number, _page: number, _pageSize: number) => sessionsPage,
);

const fakeRepo = {
	playerSessions: {
		getRangeActivity: mockGetRangeActivity,
		listSessions: mockListSessions,
	},
};

mock.module('@fxmanager/database', () => ({ repo: fakeRepo }));
mock.module('../../middleware/session', () => ({
	sessionAuth: async (req: any, reply: any) => {
		if (!authed) {
			return reply.code(401).send({ success: false, error: 'Unauthorized' });
		}
		req.admin = currentAdmin;
	},
}));

const { default: PlayersModule } = await import('./players');

const fakeGm = { getPlayer: () => undefined } as any;

const DAY_MS = 86_400_000;

describe('players activity + sessions endpoints (HTTP)', () => {
	let app: FastifyInstance;

	const get = (url: string) => app.inject({ method: 'GET', url });

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
		authed = true;
		mockGetRangeActivity.mockClear();
		mockListSessions.mockClear();
	});

	it('GET /:id/activity returns days + summary over a default ~30-day window', async () => {
		const res = await get('/players/10/activity');

		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ success: true, data: activityPayload });

		expect(mockGetRangeActivity).toHaveBeenCalledTimes(1);
		const call = mockGetRangeActivity.mock.calls[0];
		expect(call?.[0]).toBe(10);
		const from = call?.[1] as Date;
		const to = call?.[2] as Date;
		expect(from).toBeInstanceOf(Date);
		expect(to).toBeInstanceOf(Date);
		// default window spans 30 calendar days (29 full days + end-of-today)
		expect(Math.round((to.getTime() - from.getTime()) / DAY_MS)).toBe(30);
	});

	it('GET /:id/activity?from&to honours the explicit range', async () => {
		const res = await get('/players/10/activity?from=2026-06-01&to=2026-06-30');

		expect(res.statusCode).toBe(200);
		const call = mockGetRangeActivity.mock.calls[0];
		expect(call?.[0]).toBe(10);
		const from = call?.[1] as Date;
		const to = call?.[2] as Date;
		expect(from.getTime()).toBe(new Date('2026-06-01T00:00:00.000').getTime());
		expect(to.getTime()).toBe(new Date('2026-06-30T23:59:59.999').getTime());
	});

	it('GET /:id/sessions paginates with explicit page/pageSize', async () => {
		const res = await get('/players/10/sessions?page=1&pageSize=2');

		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject(sessionsPage);
		expect(mockListSessions).toHaveBeenCalledWith(10, 1, 2);
	});

	it('GET /:id/sessions defaults to page 1, pageSize 25', async () => {
		const res = await get('/players/10/sessions');

		expect(res.statusCode).toBe(200);
		expect(mockListSessions).toHaveBeenCalledWith(10, 1, 25);
	});

	it('requires auth for activity (401 without a session)', async () => {
		authed = false;
		const res = await get('/players/10/activity');

		expect(res.statusCode).toBe(401);
		expect(mockGetRangeActivity).not.toHaveBeenCalled();
	});

	it('requires auth for sessions (401 without a session)', async () => {
		authed = false;
		const res = await get('/players/10/sessions');

		expect(res.statusCode).toBe(401);
		expect(mockListSessions).not.toHaveBeenCalled();
	});
});
