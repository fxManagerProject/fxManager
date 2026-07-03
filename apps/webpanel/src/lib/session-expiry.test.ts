import { beforeEach, describe, expect, it } from 'bun:test';
import { notifyUnauthorized, setUnauthorizedHandler } from './session-expiry';

describe('session-expiry', () => {
	beforeEach(() => setUnauthorizedHandler(null));

	it('does nothing when no handler is registered', () => {
		expect(() => notifyUnauthorized()).not.toThrow();
	});

	it('invokes the registered handler', () => {
		let called = 0;
		setUnauthorizedHandler(() => {
			called++;
		});
		notifyUnauthorized();
		expect(called).toBe(1);
	});

	it('stops invoking after the handler is cleared', () => {
		let called = 0;
		setUnauthorizedHandler(() => {
			called++;
		});
		setUnauthorizedHandler(null);
		notifyUnauthorized();
		expect(called).toBe(0);
	});
});
