/** biome-ignore-all lint/suspicious/noExplicitAny: mocking singletons */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';

const mockGetMultiple = mock(() => ({
	'restarts.enabled': 'true',
	'restarts.times': '03:00',
}));
mock.module('@fxmanager/database', () => ({
	repo: { settings: { getMultiple: mockGetMultiple } },
}));

import { txAdminCompat } from '../txadmin/compat';
const { RestartScheduler } = await import('./manager');

describe('RestartScheduler', () => {
	let scheduler: InstanceType<typeof RestartScheduler>;
	let pm: { getState: any; restart: any };
	let restartMock: any;
	let emitSpy: any;

	const at = (h: number, m: number, s = 0) => new Date(2026, 0, 1, h, m, s);
	const warnings = (seconds: number) =>
		emitSpy.mock.calls.filter(
			(c: any[]) =>
				c[0] === 'scheduledRestart' && c[1].secondsRemaining === seconds,
		);

	beforeEach(() => {
		restartMock = mock(async () => true);
		pm = { getState: mock(() => ({ status: 'running' })), restart: restartMock };
		emitSpy = spyOn(txAdminCompat, 'emit').mockResolvedValue(undefined);
		mockGetMultiple.mockReturnValue({
			'restarts.enabled': 'true',
			'restarts.times': '03:00',
		});
		scheduler = new RestartScheduler();
		scheduler.attach(pm as any);
		scheduler.reload();
	});

	afterEach(() => {
		emitSpy.mockRestore();
		scheduler.stop();
	});

	it('does nothing when disabled', () => {
		mockGetMultiple.mockReturnValue({
			'restarts.enabled': 'false',
			'restarts.times': '03:00',
		});
		scheduler.reload();

		scheduler.tick(at(2, 59, 50));

		expect(emitSpy).not.toHaveBeenCalled();
		expect(restartMock).not.toHaveBeenCalled();
	});

	it('fires a scheduledRestart warning once as a threshold is crossed', () => {
		scheduler.tick(at(2, 50, 0)); // S=600 -> fire 10-minute mark
		scheduler.tick(at(2, 50, 30)); // S=570 -> 600 already fired

		expect(warnings(600)).toHaveLength(1);
		expect(emitSpy).toHaveBeenCalledWith('scheduledRestart', {
			secondsRemaining: 600,
			translatedMessage: 'Server restarting in 10 minutes',
		});
	});

	it('does not fire warnings whose mark already passed when starting mid-window', () => {
		scheduler.tick(at(2, 54, 55)); // S=305 init, suppress 1800/900/600
		scheduler.tick(at(2, 55, 5)); // S=295 -> fire 300

		expect(warnings(600)).toHaveLength(0);
		expect(warnings(300)).toHaveLength(1);
	});

	it('restarts at T-0 when the server is running', () => {
		scheduler.tick(at(2, 0, 0)); // init target 03:00
		scheduler.tick(at(3, 0, 1)); // T-0

		expect(restartMock).toHaveBeenCalledTimes(1);
		expect(restartMock).toHaveBeenCalledWith({
			author: 'Scheduler',
			message: 'Scheduled restart',
		});
	});

	it('does not restart when the server is not running', () => {
		pm.getState.mockReturnValue({ status: 'stopped' });

		scheduler.tick(at(2, 0, 0));
		scheduler.tick(at(3, 0, 1));

		expect(restartMock).not.toHaveBeenCalled();
	});

	it('skips the next daily restart (not temporary) and emits scheduledRestartSkipped', () => {
		const res = scheduler.skipNext('admin', at(2, 0, 0));

		expect(res.skipped).toBe(true);
		expect(emitSpy).toHaveBeenCalledWith(
			'scheduledRestartSkipped',
			expect.objectContaining({ temporary: false, author: 'admin' }),
		);

		scheduler.tick(at(2, 0, 0));
		scheduler.tick(at(3, 0, 1));

		expect(restartMock).not.toHaveBeenCalled();
	});

	it('reports schedule status', () => {
		const status = scheduler.getStatus(at(2, 0, 0));

		expect(status).toEqual({
			enabled: true,
			times: ['03:00'],
			nextRestart: new Date(2026, 0, 1, 3, 0, 0).toISOString(),
			temporary: false,
			skipped: false,
		});
	});

	describe('temporary restarts', () => {
		it('schedules a one-off restart N minutes out and reports it as temporary', () => {
			scheduler.scheduleTemp(5, at(2, 0, 0));

			const status = scheduler.getStatus(at(2, 0, 0));
			expect(status.temporary).toBe(true);
			expect(status.nextRestart).toBe(new Date(2026, 0, 1, 2, 5, 0).toISOString());
		});

		it('takes precedence over a later daily restart', () => {
			// daily is 03:00 (1h away); temp +5 is sooner
			scheduler.scheduleTemp(5, at(2, 0, 0));
			const status = scheduler.getStatus(at(2, 0, 0));
			expect(status.nextRestart).toBe(new Date(2026, 0, 1, 2, 5, 0).toISOString());
		});

		it('works even when the daily schedule is disabled', () => {
			mockGetMultiple.mockReturnValue({
				'restarts.enabled': 'false',
				'restarts.times': '',
			});
			scheduler.reload();

			scheduler.scheduleTemp(5, at(2, 0, 0));
			expect(scheduler.getStatus(at(2, 0, 0)).nextRestart).toBe(
				new Date(2026, 0, 1, 2, 5, 0).toISOString(),
			);
		});

		it('restarts at the temp time then consumes the temp target', () => {
			scheduler.scheduleTemp(5, at(2, 0, 0));
			scheduler.tick(at(2, 5, 1));

			expect(restartMock).toHaveBeenCalledTimes(1);
			// temp consumed: next is the daily 03:00 again
			expect(scheduler.getStatus(at(2, 6, 0)).temporary).toBe(false);
		});

		it('fires a warning when the temp restart is scheduled within a threshold', () => {
			scheduler.scheduleTemp(5, at(2, 0, 0));
			expect(emitSpy).toHaveBeenCalledWith(
				'scheduledRestart',
				expect.objectContaining({ secondsRemaining: 300 }),
			);
		});

		it('skipNext cancels a pending temp restart (temporary: true)', () => {
			scheduler.scheduleTemp(5, at(2, 0, 0));
			const res = scheduler.skipNext('admin', at(2, 0, 30));

			expect(res.skipped).toBe(true);
			expect(emitSpy).toHaveBeenCalledWith(
				'scheduledRestartSkipped',
				expect.objectContaining({ temporary: true }),
			);
			// temp gone -> next reverts to daily
			expect(scheduler.getStatus(at(2, 1, 0)).temporary).toBe(false);
		});
	});

	describe('txAdmin scheduledRestart parity', () => {
		it('fires the full txAdmin mark set with exact secondsRemaining values', () => {
			scheduler.scheduleTemp(30, at(2, 0, 0)); // target 02:30, fires 1800 now
			scheduler.tick(at(2, 15, 0));
			scheduler.tick(at(2, 20, 0));
			scheduler.tick(at(2, 25, 0));
			scheduler.tick(at(2, 26, 0));
			scheduler.tick(at(2, 27, 0));
			scheduler.tick(at(2, 28, 0));
			scheduler.tick(at(2, 29, 0));

			const fired = emitSpy.mock.calls
				.filter((c: any[]) => c[0] === 'scheduledRestart')
				.map((c: any[]) => c[1].secondsRemaining);

			expect(fired).toEqual([1800, 900, 600, 300, 240, 180, 120, 60]);
		});

		it('does not emit any non-txAdmin (sub-minute) marks', () => {
			scheduler.scheduleTemp(2, at(2, 0, 0)); // 120s out
			scheduler.tick(at(2, 1, 30)); // 30s remaining
			scheduler.tick(at(2, 1, 50)); // 10s remaining

			const fired = emitSpy.mock.calls
				.filter((c: any[]) => c[0] === 'scheduledRestart')
				.map((c: any[]) => c[1].secondsRemaining);

			expect(fired).not.toContain(30);
			expect(fired).not.toContain(10);
		});
	});
});
