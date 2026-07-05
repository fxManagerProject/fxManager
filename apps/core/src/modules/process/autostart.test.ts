import { describe, expect, it } from 'bun:test';
import {
	parseBoolFlag,
	resolveAutostartEnabled,
	shouldAutostart,
} from './autostart';

describe('parseBoolFlag', () => {
	it('treats true/1/yes/on (any case, trimmed) as true', () => {
		for (const value of ['true', 'TRUE', '1', 'yes', 'YES', 'on', ' On ']) {
			expect(parseBoolFlag(value)).toBe(true);
		}
	});

	it('treats everything else as false', () => {
		for (const value of ['false', '0', 'no', 'off', '', ' ', 'nope']) {
			expect(parseBoolFlag(value)).toBe(false);
		}
	});
});

describe('resolveAutostartEnabled', () => {
	it('defaults to enabled when nothing is configured', () => {
		expect(resolveAutostartEnabled(undefined, undefined)).toBe(true);
	});

	it('uses the env value when no persisted setting exists', () => {
		expect(resolveAutostartEnabled(undefined, 'false')).toBe(false);
		expect(resolveAutostartEnabled(undefined, 'true')).toBe(true);
	});

	it('lets the persisted panel setting win over the env value', () => {
		expect(resolveAutostartEnabled('false', 'true')).toBe(false);
		expect(resolveAutostartEnabled('true', 'false')).toBe(true);
	});

	it('ignores empty strings and falls through to the next source', () => {
		expect(resolveAutostartEnabled('', 'false')).toBe(false);
		expect(resolveAutostartEnabled('', '')).toBe(true);
	});
});

describe('shouldAutostart', () => {
	it('starts when setup is complete, enabled, and the server is stopped', () => {
		expect(
			shouldAutostart({
				setupComplete: true,
				enabled: true,
				status: 'stopped',
			}),
		).toBe(true);
	});

	it('also starts from a crashed state', () => {
		expect(
			shouldAutostart({
				setupComplete: true,
				enabled: true,
				status: 'crashed',
			}),
		).toBe(true);
	});

	it('does not start before first-run setup is complete', () => {
		expect(
			shouldAutostart({
				setupComplete: false,
				enabled: true,
				status: 'stopped',
			}),
		).toBe(false);
	});

	it('does not start when disabled', () => {
		expect(
			shouldAutostart({
				setupComplete: true,
				enabled: false,
				status: 'stopped',
			}),
		).toBe(false);
	});

	it('does not start when the server is already running or busy', () => {
		for (const status of ['running', 'starting', 'stopping'] as const) {
			expect(
				shouldAutostart({ setupComplete: true, enabled: true, status }),
			).toBe(false);
		}
	});
});
