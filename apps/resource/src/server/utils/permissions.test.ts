import { afterEach, describe, expect, it, mock } from 'bun:test';
import { getPermissions } from './permissions'; // Adjust import path as needed
import { UserPermissions } from '@fxmanager/shared/constants';

describe('getPermissions', () => {
	const originalIsPlayerAceAllowed = globalThis.IsPlayerAceAllowed;

	afterEach(() => {
		// Restore global scope after each test
		globalThis.IsPlayerAceAllowed = originalIsPlayerAceAllowed;
	});

	it('returns 0 when the player has no allowed ACE permissions', () => {
		globalThis.IsPlayerAceAllowed = mock(() => false);

		const permissions = getPermissions(1);

		expect(permissions).toBe(UserPermissions.NONE);
		expect(globalThis.IsPlayerAceAllowed).toHaveBeenCalled();
	});

	it('calculates the exact bitmask for a single allowed permission', () => {
		globalThis.IsPlayerAceAllowed = mock((src: string, ace: string) => {
			return src === '1' && ace === 'fxmanager.players.kick';
		});

		const permissions = getPermissions(1);

		expect(permissions).toBe(UserPermissions.KICK);
		expect(permissions & UserPermissions.KICK).not.toBe(0);
		expect(permissions & UserPermissions.BAN).toBe(0);
	});

	it('combines multiple allowed ACE permissions into a single bitmask', () => {
		const allowedAces = new Set([
			'fxmanager.players.kick',
			'fxmanager.players.ban',
			'fxmanager.reports.view',
		]);

		globalThis.IsPlayerAceAllowed = mock((src: string, ace: string) => {
			return src === '12' && allowedAces.has(ace);
		});

		const permissions = getPermissions(12);

		const expected =
			UserPermissions.KICK | UserPermissions.BAN | UserPermissions.VIEW_REPORT;

		expect(permissions).toBe(expected);
		expect(permissions & UserPermissions.KICK).not.toBe(0);
		expect(permissions & UserPermissions.BAN).not.toBe(0);
		expect(permissions & UserPermissions.VIEW_REPORT).not.toBe(0);
		expect(permissions & UserPermissions.WARN).toBe(0);
	});

	it('returns a combined sum of all bits when every ACE permission is allowed', () => {
		globalThis.IsPlayerAceAllowed = mock(() => true);

		const permissions = getPermissions(1);

		expect(permissions).toBeGreaterThan(0);
		expect(permissions & UserPermissions.KICK).not.toBe(0);
		expect(permissions & UserPermissions.CONFIG_EDITOR).not.toBe(0);
	});

	it('passes the player source parameter converted to a string', () => {
		const mockAceCheck = mock(() => false);
		globalThis.IsPlayerAceAllowed = mockAceCheck;

		getPermissions(42);

		expect(mockAceCheck).toHaveBeenCalledWith('42', expect.any(String));
	});
});
