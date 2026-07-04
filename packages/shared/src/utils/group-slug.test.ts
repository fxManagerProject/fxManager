import { describe, expect, it } from 'bun:test';
import { slugifyGroupName } from './group-slug';

describe('slugifyGroupName()', () => {
	it('should lowercase and keep simple names', () => {
		expect(slugifyGroupName('Moderator')).toBe('moderator');
	});

	it('should replace whitespace runs with a single underscore', () => {
		expect(slugifyGroupName('Head Admin')).toBe('head_admin');
		expect(slugifyGroupName('Head   Admin')).toBe('head_admin');
	});

	it('should treat dashes like spaces', () => {
		expect(slugifyGroupName('Head-Admin')).toBe('head_admin');
	});

	it('should strip characters outside [a-z0-9_]', () => {
		expect(slugifyGroupName('Moderator!!')).toBe('moderator');
		expect(slugifyGroupName('super/admin')).toBe('superadmin');
	});

	it('should trim leading and trailing underscores', () => {
		expect(slugifyGroupName('  Moderator  ')).toBe('moderator');
		expect(slugifyGroupName('_mod_')).toBe('mod');
	});

	it('should keep digits', () => {
		expect(slugifyGroupName('Level 3')).toBe('level_3');
	});

	it('should return empty string when nothing survives', () => {
		expect(slugifyGroupName('🎮')).toBe('');
		expect(slugifyGroupName('   ')).toBe('');
		expect(slugifyGroupName('')).toBe('');
	});

	it('should neutralise console-command injection attempts', () => {
		expect(slugifyGroupName('mod allow; quit')).toBe('mod_allow_quit');
	});

	it('should be safe against non-string input', () => {
		// biome-ignore lint/suspicious/noExplicitAny: guarding runtime misuse
		expect(slugifyGroupName(undefined as any)).toBe('');
	});
});
