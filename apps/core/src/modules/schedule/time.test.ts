import { describe, expect, it } from 'bun:test';
import {
	WARNING_THRESHOLDS,
	computeNextRestart,
	formatCountdown,
	parseTimes,
} from './time';

describe('parseTimes', () => {
	it('parses HH:MM into sorted minutes-since-midnight', () => {
		expect(parseTimes('15:00,03:00')).toEqual([180, 900]);
	});

	it('ignores malformed, out-of-range, and empty entries', () => {
		expect(parseTimes('bad,25:00,03:60,03:00,, ')).toEqual([180]);
	});

	it('returns an empty array for an empty string', () => {
		expect(parseTimes('')).toEqual([]);
	});

	it('dedupes repeated times', () => {
		expect(parseTimes('03:00,03:00')).toEqual([180]);
	});
});

describe('computeNextRestart', () => {
	it('picks the next time later today', () => {
		const now = new Date(2026, 0, 1, 2, 0, 0);
		expect(computeNextRestart([180], now)).toEqual(
			new Date(2026, 0, 1, 3, 0, 0),
		);
	});

	it('rolls to tomorrow when every time today has passed', () => {
		const now = new Date(2026, 0, 1, 4, 0, 0);
		expect(computeNextRestart([180], now)).toEqual(
			new Date(2026, 0, 2, 3, 0, 0),
		);
	});

	it('chooses the earliest upcoming among several times', () => {
		const now = new Date(2026, 0, 1, 2, 0, 0);
		// 01:00 already passed -> tomorrow; 03:00 today is the soonest
		expect(computeNextRestart([60, 180], now)).toEqual(
			new Date(2026, 0, 1, 3, 0, 0),
		);
	});

	it('treats an exact match as passed (advances)', () => {
		const now = new Date(2026, 0, 1, 3, 0, 0);
		expect(computeNextRestart([180], now)).toEqual(
			new Date(2026, 0, 2, 3, 0, 0),
		);
	});

	it('returns null with no times', () => {
		expect(computeNextRestart([], new Date())).toBeNull();
	});
});

describe('formatCountdown', () => {
	it('formats whole minutes', () => {
		expect(formatCountdown(300)).toBe('Server restarting in 5 minutes');
		expect(formatCountdown(60)).toBe('Server restarting in 1 minute');
		expect(formatCountdown(1800)).toBe('Server restarting in 30 minutes');
	});

	it('formats sub-minute marks in seconds', () => {
		expect(formatCountdown(30)).toBe('Server restarting in 30 seconds');
		expect(formatCountdown(10)).toBe('Server restarting in 10 seconds');
	});
});

describe('WARNING_THRESHOLDS', () => {
	it('matches txAdmin marks: [30,15,10,5,4,3,2,1] minutes in seconds', () => {
		expect(WARNING_THRESHOLDS).toEqual([
			1800, 900, 600, 300, 240, 180, 120, 60,
		]);
	});
});
