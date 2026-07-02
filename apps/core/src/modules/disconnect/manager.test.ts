import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { ServerSession } from '@fxmanager/shared/types';
import { wsManager } from '../ws/manager';

const mockRecordEvent = mock(() => {});

mock.module('@fxmanager/database', () => ({
	repo: {
		disconnects: {
			recordEvent: mockRecordEvent,
		},
	},
}));

const { disconnectManager } = await import('./manager');

const stubSession = (): ServerSession => ({
	id: 1,
	startedAt: 1000,
	endedAt: 5000,
	closeReason: null,
});

describe('disconnectManager', () => {
	let wsSpy: ReturnType<typeof spyOn>;
	beforeEach(() => {
		mockRecordEvent.mockReset();
		wsSpy = spyOn(wsManager, 'broadcast').mockImplementation(() => {});
		// clear any live session leaking between tests
		disconnectManager.onSessionClose(null);
	});
	afterEach(() => wsSpy.mockRestore());

	it('onSessionOpen sets a zeroed live session and broadcasts', () => {
		disconnectManager.onSessionOpen(stubSession());
		const live = disconnectManager.getLiveSession()!;
		expect(live.id).toBe(1);
		expect(live.startedAt).toBe(1000);
		expect(live.endedAt).toBeNull();
		expect(live.quit + live.crash + live.timeout + live.kick + live.other).toBe(
			0,
		);
		expect(wsSpy).toHaveBeenCalled();
	});

	it('records a classified drop: persists an event + bumps live counter + broadcasts', () => {
		disconnectManager.onSessionOpen(stubSession());
		wsSpy.mockClear();
		disconnectManager.recordDrop({ reason: 'Game crashed: x', category: 2 });
		expect(mockRecordEvent).toHaveBeenCalledWith(
			1,
			expect.any(Number),
			'crash',
		);
		expect(disconnectManager.getLiveSession()?.crash).toBe(1);
		expect(wsSpy).toHaveBeenCalledTimes(1);
	});

	it('ignores server-shutdown drops (no event)', () => {
		disconnectManager.onSessionOpen(stubSession());
		disconnectManager.recordDrop({ reason: 'x', category: 7 });
		expect(mockRecordEvent).not.toHaveBeenCalled();
	});

	it('does not record when there is no live session', () => {
		disconnectManager.recordDrop({ reason: 'Exiting', category: 2 });
		expect(mockRecordEvent).not.toHaveBeenCalled();
	});

	it('onSessionClose sets endedAt, broadcasts, and clears live', () => {
		disconnectManager.onSessionOpen(stubSession());
		wsSpy.mockClear();
		disconnectManager.onSessionClose(stubSession());
		expect(disconnectManager.getLiveSession()).toBeNull();
		expect(wsSpy).toHaveBeenCalledTimes(1);
		const msg = wsSpy.mock.calls[0]?.[0] as {
			data: { endedAt: number | null };
		};
		expect(msg.data.endedAt).toBe(5000);
	});

	it('onSessionClose with no live session is a no-op', () => {
		disconnectManager.onSessionClose(stubSession());
		expect(wsSpy).not.toHaveBeenCalled();
	});
});
