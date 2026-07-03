import { describe, expect, it } from 'bun:test';
import { isValidResourceName } from './resource-name';

describe('isValidResourceName()', () => {
	it('accepts ordinary FiveM resource names', () => {
		expect(isValidResourceName('chat')).toBe(true);
		expect(isValidResourceName('es_extended')).toBe(true);
		expect(isValidResourceName('my-resource')).toBe(true);
		expect(isValidResourceName('pack.core')).toBe(true);
		expect(isValidResourceName('a1_2-3.x')).toBe(true);
	});

	it('rejects an empty name', () => {
		expect(isValidResourceName('')).toBe(false);
	});

	it('rejects names containing a newline (console command injection)', () => {
		expect(isValidResourceName('chat\nquit')).toBe(false);
		expect(isValidResourceName('chat\r\nset foo bar')).toBe(false);
	});

	it('rejects names containing whitespace', () => {
		expect(isValidResourceName('my resource')).toBe(false);
		expect(isValidResourceName('chat\ttab')).toBe(false);
		expect(isValidResourceName(' chat')).toBe(false);
	});

	it('rejects names with console metacharacters', () => {
		expect(isValidResourceName('chat;quit')).toBe(false);
		expect(isValidResourceName('chat&&quit')).toBe(false);
		expect(isValidResourceName('chat"quit')).toBe(false);
		expect(isValidResourceName('chat$(quit)')).toBe(false);
	});

	it('rejects a name longer than 64 characters', () => {
		expect(isValidResourceName('a'.repeat(64))).toBe(true);
		expect(isValidResourceName('a'.repeat(65))).toBe(false);
	});

	it('rejects non-string input', () => {
		expect(isValidResourceName(undefined as unknown as string)).toBe(false);
		expect(isValidResourceName(null as unknown as string)).toBe(false);
		expect(isValidResourceName(42 as unknown as string)).toBe(false);
	});
});
