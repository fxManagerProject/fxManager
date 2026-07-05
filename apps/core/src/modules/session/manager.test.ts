import {
	afterAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';
import type { ServerSession } from '@fxmanager/shared/types';
import { wsManager } from '../ws/manager';

const openStub = (): ServerSession => ({
	id: 7,
	startedAt: 1000,
	endedAt: null,
	closeReason: null,
});
const closedStub = (): ServerSession => ({
	id: 7,
	startedAt: 1000,
	endedAt: 5000,
	closeReason: 'crashed',
});

const mockOpen = mock(() => openStub());
const mockClose = mock(() => closedStub());
const mockCloseDangling = mock(() => {});
const mockPrune = mock(() => {});
const mockListRecent = mock(() => [closedStub()]);
const mockPlayerCloseDangling = mock(() => {});

mock.module('@fxmanager/database', () => ({
	repo: {
		serverSessions: {
			open: mockOpen,
			close: mockClose,
			closeDangling: mockCloseDangling,
			prune: mockPrune,
			listRecent: mockListRecent,
		},
		playerSessions: {
			closeDangling: mockPlayerCloseDangling,
		},
	},
}));

const { sessionManager } = await import('./manager');

describe('sessionManager', () => {
	const wsSpy = spyOn(wsManager, 'broadcast').mockImplementation(() => {});

	beforeEach(() => {
		// clear any current session leaking between tests, then reset mocks
		(sessionManager as unknown as { current: ServerSession | null }).current =
			null;
		mockOpen.mockReset().mockReturnValue(openStub());
		mockClose.mockReset().mockReturnValue(closedStub());
		mockCloseDangling.mockReset();
		mockPrune.mockReset();
		mockListRecent.mockReset().mockReturnValue([closedStub()]);
		mockPlayerCloseDangling.mockReset();
		wsSpy.mockClear();
	});

	afterAll(() => {
		wsSpy.mockRestore();
	});

	it('init closes dangling sessions from a previous run', () => {
		sessionManager.init();
		expect(mockCloseDangling).toHaveBeenCalledTimes(1);
	});

	it('init reconciles dangling player sessions after server sessions', () => {
		const order: string[] = [];
		mockCloseDangling.mockImplementation(() => {
			order.push('server');
		});
		mockPlayerCloseDangling.mockImplementation(() => {
			order.push('player');
		});
		sessionManager.init();
		expect(mockPlayerCloseDangling).toHaveBeenCalledTimes(1);
		expect(order).toEqual(['server', 'player']);
	});

	it('openSession opens, caches, and does not double-open', () => {
		const s = sessionManager.openSession();
		expect(s.id).toBe(7);
		expect(mockOpen).toHaveBeenCalledTimes(1);
		expect(sessionManager.getCurrent()?.id).toBe(7);
		expect(sessionManager.getCurrentId()).toBe(7);

		const again = sessionManager.openSession();
		expect(again).toBe(s);
		expect(mockOpen).toHaveBeenCalledTimes(1);
	});

	it('closeSession calls close + prune, returns closed, and clears current', () => {
		sessionManager.openSession();
		const closed = sessionManager.closeSession('crashed');
		expect(mockClose).toHaveBeenCalledWith(7, 'crashed');
		expect(mockPrune).toHaveBeenCalledTimes(1);
		expect(closed?.endedAt).toBe(5000);
		expect(sessionManager.getCurrent()).toBeNull();
		expect(sessionManager.getCurrentId()).toBeNull();
	});

	it('closeSession with no current session is a no-op', () => {
		const closed = sessionManager.closeSession();
		expect(closed).toBeNull();
		expect(mockClose).not.toHaveBeenCalled();
		expect(mockPrune).not.toHaveBeenCalled();
	});

	it('tracks player count', () => {
		expect(sessionManager.getPlayerCount()).toBe(0);
		sessionManager.setPlayerCount(4);
		expect(sessionManager.getPlayerCount()).toBe(4);
	});

	it('openSession resets player count', () => {
		sessionManager.setPlayerCount(9);
		sessionManager.openSession();
		expect(sessionManager.getPlayerCount()).toBe(0);
	});

	it('broadcasts the refreshed session list on open and close', () => {
		sessionManager.openSession();
		expect(wsSpy).toHaveBeenCalledWith({
			channel: 'sessions',
			event: 'update',
			data: [closedStub()],
		});

		wsSpy.mockClear();
		sessionManager.closeSession('crashed');
		expect(wsSpy).toHaveBeenCalledWith({
			channel: 'sessions',
			event: 'update',
			data: [closedStub()],
		});
	});

	it('does not broadcast when closeSession is a no-op', () => {
		sessionManager.closeSession();
		expect(wsSpy).not.toHaveBeenCalled();
	});
});
