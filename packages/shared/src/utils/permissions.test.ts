import { describe, expect, it } from 'bun:test';
import { PermissionManager } from './permissions';
import { UserPermissions } from '@fxmanager/shared/constants';

describe('PermissionManager Unit Tests', () => {
	describe('has() Bitwise Evaluations', () => {
		it('should grant immediate access (return true) if user contains the MASTER bitfield flag', () => {
			const userBitfield = UserPermissions.MASTER;

			// Checking for a completely unassigned high permission
			const result = PermissionManager.has(userBitfield, UserPermissions.BAN);
			expect(result).toBe(true);
		});

		it('should validate access correctly when a user holds the exact matching explicit bit', () => {
			const userBitfield = UserPermissions.KICK | UserPermissions.WARN;

			expect(PermissionManager.has(userBitfield, UserPermissions.KICK)).toBe(
				true,
			);
			expect(PermissionManager.has(userBitfield, UserPermissions.WARN)).toBe(
				true,
			);
		});

		it('should deny access (return false) if the required bit is completely missing from the user field', () => {
			const userBitfield = UserPermissions.KICK;

			const result = PermissionManager.has(userBitfield, UserPermissions.BAN);
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
				UserPermissions.KICK | UserPermissions.BAN | UserPermissions.WARN;
			const requirements = [UserPermissions.KICK, UserPermissions.BAN];

			expect(PermissionManager.hasAll(userBitfield, requirements)).toBe(true);
		});

		it('should fail evaluations if even a single parameter array criteria goes unmet', () => {
			const userBitfield = UserPermissions.KICK | UserPermissions.WARN; // Missing BAN
			const requirements = [UserPermissions.KICK, UserPermissions.BAN];

			expect(PermissionManager.hasAll(userBitfield, requirements)).toBe(false);
		});
	});

	describe('Bitwise Field Mutations', () => {
		it('should cleanly append additional bits using bitwise OR structures during grant operations', () => {
			const initialField = UserPermissions.KICK;

			const updatedField = PermissionManager.grant(
				initialField,
				UserPermissions.BAN,
			);

			expect(updatedField).toBe(UserPermissions.KICK | UserPermissions.BAN);
			expect(PermissionManager.has(updatedField, UserPermissions.KICK)).toBe(
				true,
			);
			expect(PermissionManager.has(updatedField, UserPermissions.BAN)).toBe(
				true,
			);
		});

		it('should strip clean slices out of fields using inversion masks during revoke operations', () => {
			const initialField = UserPermissions.KICK | UserPermissions.BAN;

			const updatedField = PermissionManager.revoke(
				initialField,
				UserPermissions.BAN,
			);

			expect(updatedField).toBe(UserPermissions.KICK);
			expect(PermissionManager.has(updatedField, UserPermissions.BAN)).toBe(
				false,
			);
			expect(PermissionManager.has(updatedField, UserPermissions.KICK)).toBe(
				true,
			);
		});
	});

	describe('isMaster()', () => {
		it('should return true only when the MASTER bit is set', () => {
			expect(PermissionManager.isMaster(UserPermissions.MASTER)).toBe(true);
			expect(
				PermissionManager.isMaster(UserPermissions.MASTER | UserPermissions.KICK),
			).toBe(true);
			expect(PermissionManager.isMaster(UserPermissions.KICK)).toBe(false);
			expect(PermissionManager.isMaster(0)).toBe(false);
		});
	});

	describe('effective() Group Composition', () => {
		it('should union personal and group bitfields', () => {
			const result = PermissionManager.effective(
				UserPermissions.KICK,
				UserPermissions.WARN,
			);

			expect(result).toBe(UserPermissions.KICK | UserPermissions.WARN);
		});

		it('should return the personal bitfield when no group permissions exist', () => {
			expect(PermissionManager.effective(UserPermissions.BAN, null)).toBe(
				UserPermissions.BAN,
			);
			expect(PermissionManager.effective(UserPermissions.BAN, undefined)).toBe(
				UserPermissions.BAN,
			);
		});
	});
});
