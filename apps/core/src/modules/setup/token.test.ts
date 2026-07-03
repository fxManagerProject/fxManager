import { beforeEach, describe, expect, it } from 'bun:test';
import { setupTokenManager } from './token';

describe('setupTokenManager', () => {
	beforeEach(() => {
		setupTokenManager.clear();
	});

	it('has no token until ensured', () => {
		expect(setupTokenManager.get()).toBeNull();
		expect(setupTokenManager.validate('anything')).toBe(false);
	});

	it('generates a token on ensure() and is idempotent', () => {
		const first = setupTokenManager.ensure();
		expect(first).toBeTruthy();
		expect(setupTokenManager.ensure()).toBe(first);
		expect(setupTokenManager.get()).toBe(first);
	});

	it('validates the correct token and rejects others', () => {
		const token = setupTokenManager.ensure();
		expect(setupTokenManager.validate(token)).toBe(true);
		expect(setupTokenManager.validate(`${token}x`)).toBe(false);
		expect(setupTokenManager.validate('wrong')).toBe(false);
	});

	it('rejects non-string candidates', () => {
		setupTokenManager.ensure();
		expect(setupTokenManager.validate(undefined)).toBe(false);
		expect(setupTokenManager.validate(null)).toBe(false);
		expect(setupTokenManager.validate(42)).toBe(false);
	});

	it('clears the token after setup completes', () => {
		const token = setupTokenManager.ensure();
		setupTokenManager.clear();
		expect(setupTokenManager.get()).toBeNull();
		expect(setupTokenManager.validate(token)).toBe(false);
	});
});
