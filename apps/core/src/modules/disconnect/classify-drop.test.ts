import { describe, expect, it } from 'bun:test';
import { classifyDrop } from './classify-drop';

describe('classifyDrop — numeric category path', () => {
	it('CLIENT with normal reason → quit', () => {
		expect(classifyDrop({ reason: 'Exiting', category: 2 })).toBe('quit');
	});
	it('CLIENT with crash prefix → crash', () => {
		expect(classifyDrop({ reason: 'Game crashed: ERR_MEM', category: 2 })).toBe('crash');
	});
	it('CLIENT with translated crash prefix (pt) → crash', () => {
		expect(classifyDrop({ reason: 'O jogo crashou: erro', category: 2 })).toBe('crash');
	});
	it('CLIENT_CONNECTION_TIMED_OUT → timeout', () => {
		expect(classifyDrop({ reason: 'server->client connection timed out', category: 5 })).toBe('timeout');
	});
	it('ONE_SYNC_TOO_MANY_MISSED_FRAMES → timeout', () => {
		expect(classifyDrop({ reason: 'onesync', category: 12 })).toBe('timeout');
	});
	it('RESOURCE kick → kick', () => {
		expect(classifyDrop({ reason: 'You were banned', category: 1 })).toBe('kick');
	});
	it('SERVER-initiated → kick', () => {
		expect(classifyDrop({ reason: 'kicked', category: 3 })).toBe('kick');
	});
	it('RESOURCE server_shutting_down → ignored (null)', () => {
		expect(classifyDrop({ reason: 'server_shutting_down', category: 1 })).toBeNull();
	});
	it('SERVER_SHUTDOWN → ignored (null)', () => {
		expect(classifyDrop({ reason: 'whatever', category: 7 })).toBeNull();
	});
	it('CLIENT_REPLACED → other', () => {
		expect(classifyDrop({ reason: 'replaced', category: 4 })).toBe('other');
	});
	it('rate-limit kick → other', () => {
		expect(classifyDrop({ reason: 'net event overflow', category: 9 })).toBe('other');
	});
});

describe('classifyDrop — string fallback (no category)', () => {
	it('crash prefix → crash', () => {
		expect(classifyDrop({ reason: 'Game crashed: kaboom' })).toBe('crash');
	});
	it('player-initiated → quit', () => {
		expect(classifyDrop({ reason: 'Disconnected.' })).toBe('quit');
	});
	it('timeout string → timeout', () => {
		expect(classifyDrop({ reason: 'server->client connection timed out' })).toBe('timeout');
	});
	it('server shutting down → ignored (null)', () => {
		expect(classifyDrop({ reason: 'Server shutting down: restart' })).toBeNull();
	});
	it('server-initiated kick → kick', () => {
		expect(classifyDrop({ reason: 'Disconnected by server: rule break' })).toBe('kick');
	});
	it('security overflow → other', () => {
		expect(classifyDrop({ reason: 'Reliable network event overflow' })).toBe('other');
	});
	it('unknown reason → other', () => {
		expect(classifyDrop({ reason: 'aliens' })).toBe('other');
	});
	it('empty / invalid reason → other', () => {
		expect(classifyDrop({ reason: '' })).toBe('other');
		expect(classifyDrop({ reason: null })).toBe('other');
	});
});

describe('classifyDrop — host-locale independence', () => {
	it('classifies crash prefixes containing I on a Turkish host locale', () => {
		const original = String.prototype.toLocaleLowerCase;
		String.prototype.toLocaleLowerCase = function (this: string) {
			return original.call(this, 'tr-TR');
		};
		try {
			const reason = 'Il gioco ha smesso di funzionare: errore';
			expect(classifyDrop({ reason, category: 2 })).toBe('crash');
			expect(classifyDrop({ reason })).toBe('crash');
		} finally {
			String.prototype.toLocaleLowerCase = original;
		}
	});
});
