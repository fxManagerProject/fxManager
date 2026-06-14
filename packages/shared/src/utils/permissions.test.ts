import { beforeEach, describe, expect, it, mock } from 'bun:test';

mock.module('@fxmanager/shared/constants', () => {
	return {
		UserPermissions: {
			NONE: 0, // 000000
			MASTER: 1 << 0, // 000001 (1)
			KICK: 1 << 1, // 000010 (2)
			BAN: 1 << 2, // 000100 (4)
			WARN: 1 << 3, // 001000 (8)
		},
		PERMISSION_GROUPS: [
			{ label: 'User', permissions: 0, colour: 'gray' },
			{ label: 'Moderator', permissions: (1 << 1) | (1 << 3), colour: 'blue' }, // KICK | WARN = 10
		],
	};
});

// Import target and mocked constants
import { PermissionManager } from './permissions';
import {
	UserPermissions,
	PERMISSION_GROUPS,
} from '@fxmanager/shared/constants';
import type { AdminGroup } from '../types';

describe('PermissionManager Unit Tests', () => {
	beforeEach(() => {
		PermissionManager.loadGroups([...PERMISSION_GROUPS] as AdminGroup[]);
	});

	describe('has() Bitwise Evaluations', () => {
		it('should grant immediate access (return true) if user contains the MASTER bitfield flag', () => {
			const userBitfield = UserPermissions.MASTER; // 1

			// Checking for a completely unassigned high permission
			const result = PermissionManager.has(userBitfield, UserPermissions.BAN);
			expect(result).toBe(true);
		});

		it('should validate access correctly when a user holds the exact matching explicit bit', () => {
			const userBitfield = UserPermissions.KICK | UserPermissions.WARN; // 2 + 8 = 10

			expect(PermissionManager.has(userBitfield, UserPermissions.KICK)).toBe(
				true,
			);
			expect(PermissionManager.has(userBitfield, UserPermissions.WARN)).toBe(
				true,
			);
		});

		it('should deny access (return false) if the required bit is completely missing from the user field', () => {
			const userBitfield = UserPermissions.KICK; // 2

			const result = PermissionManager.has(userBitfield, UserPermissions.BAN); // Requires 4
			expect(result).toBe(false);
		});
	});

	describe('hasAll() Composite Array Matrix', () => {
		it('should pass validation automatically if the user holds the MASTER bit field flag', () => {
			const userBitfield = UserPermissions.MASTER;
			const requirements = [UserPermissions.BAN, UserPermissions.KICK];

			expect(PermissionManager.hasAll(userBitfield, requirements)).toBe(true);
		});

		it('should confirm clearance if every targeted array node matches the evaluated bitfield', () => {
			const userBitfield =
				UserPermissions.KICK | UserPermissions.BAN | UserPermissions.WARN; // 2 | 4 | 8 = 14
			const requirements = [UserPermissions.KICK, UserPermissions.BAN];

			expect(PermissionManager.hasAll(userBitfield, requirements)).toBe(true);
		});

		it('should fail evaluations if even a single parameter array criteria goes unmet', () => {
			const userBitfield = UserPermissions.KICK | UserPermissions.WARN; // Missing BAN (4)
			const requirements = [UserPermissions.KICK, UserPermissions.BAN];

			expect(PermissionManager.hasAll(userBitfield, requirements)).toBe(false);
		});
	});

	describe('Bitwise Field Mutations', () => {
		it('should cleanly append additional bits using bitwise OR structures during grant operations', () => {
			const initialField = UserPermissions.KICK; // 2 (0010)

			const updatedField = PermissionManager.grant(
				initialField,
				UserPermissions.BAN,
			); // 4 (0100)

			// Expected result: 2 | 4 = 6 (0110)
			expect(updatedField).toBe(6);
			expect(PermissionManager.has(updatedField, UserPermissions.KICK)).toBe(
				true,
			);
			expect(PermissionManager.has(updatedField, UserPermissions.BAN)).toBe(
				true,
			);
		});

		it('should strip clean slices out of fields using inversion masks during revoke operations', () => {
			const initialField = UserPermissions.KICK | UserPermissions.BAN; // 6 (0110)

			const updatedField = PermissionManager.revoke(
				initialField,
				UserPermissions.BAN,
			);

			// Expected result: 6 & ~4 = 2 (0010)
			expect(updatedField).toBe(UserPermissions.KICK);
			expect(PermissionManager.has(updatedField, UserPermissions.BAN)).toBe(
				false,
			);
			expect(PermissionManager.has(updatedField, UserPermissions.KICK)).toBe(
				true,
			);
		});
	});

	describe('Group Management Lookups', () => {
		it('should dynamically update internal group trackers when calling loadGroups()', () => {
			const customGroups: AdminGroup[] = [
				{
					label: 'SuperAdmin',
					permissions: UserPermissions.MASTER | UserPermissions.BAN,
					colour: 'red',
				},
			];

			PermissionManager.loadGroups(customGroups);
			expect(PermissionManager.groups).toHaveLength(1);
			expect(PermissionManager.groups[0]?.label).toBe('SuperAdmin');
		});

		it('should match and return the first organizational group block that fits the bitfield criteria', () => {
			const prioritizedGroups: AdminGroup[] = [
				{
					label: 'Moderator',
					permissions: UserPermissions.KICK | UserPermissions.WARN,
					colour: 'blue',
				}, // 10
				{ label: 'User', permissions: 0, colour: 'gray' }, // 0
			];
			PermissionManager.loadGroups(prioritizedGroups);

			const targetPermissions =
				UserPermissions.KICK | UserPermissions.WARN | UserPermissions.BAN; // 14

			const matchedGroup = PermissionManager.getGroup(targetPermissions);

			expect(matchedGroup).not.toBeNull();
			expect(matchedGroup?.label).toBe('Moderator');
		});

		it('should safely return null if the incoming integer mask cannot map to an active group criteria', () => {
			const strictGroups: AdminGroup[] = [
				{
					label: 'Moderator',
					permissions: UserPermissions.KICK | UserPermissions.WARN,
					colour: 'blue',
				},
			];
			PermissionManager.loadGroups(strictGroups);

			const arbitraryPermissions = UserPermissions.BAN; // 4 (Does not satisfy KICK or WARN bits)

			const matchedGroup = PermissionManager.getGroup(arbitraryPermissions);
			expect(matchedGroup).toBeNull();
		});
	});
});
