import { describe, expect, it } from 'bun:test';
import {
	ACE_PREFIX,
	PERMISSION_ACE_KEYS,
	UserPermissions,
} from './permissions';

describe('PERMISSION_ACE_KEYS', () => {
	const bitsWithoutKey = [UserPermissions.NONE, UserPermissions.MASTER];

	it('should define a key for every permission bit except NONE and MASTER', () => {
		for (const [name, bit] of Object.entries(UserPermissions)) {
			if (bitsWithoutKey.includes(bit)) continue;

			expect(
				PERMISSION_ACE_KEYS[bit],
				`missing ace key for ${name}`,
			).toBeString();
		}
	});

	it('should not define keys for NONE or MASTER', () => {
		expect(PERMISSION_ACE_KEYS[UserPermissions.NONE]).toBeUndefined();
		expect(PERMISSION_ACE_KEYS[UserPermissions.MASTER]).toBeUndefined();
	});

	it('should have unique keys', () => {
		const keys = Object.values(PERMISSION_ACE_KEYS);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('should only contain lowercase dot/underscore keys safe for console commands', () => {
		for (const key of Object.values(PERMISSION_ACE_KEYS)) {
			expect(key).toMatch(/^[a-z_]+(\.[a-z_]+)*$/);
		}
	});

	it('should expose the ace prefix used for all fxmanager aces', () => {
		expect(ACE_PREFIX).toBe('fxmanager');
	});
});
