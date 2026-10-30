import { afterEach, describe, expect, it } from 'bun:test';
import type { IncidentEvent } from '@fxmanager/shared/types';
import { IncidentRecorder } from './recorder';
import { redactIncidentData, redactIncidentText } from './redact';

describe('incident capture and privacy', () => {
	let recorder: IncidentRecorder | null = null;
	afterEach(() => recorder?.stop());
	it('redacts secrets and common identifiers before storage', () => {
		const output: Omit<IncidentEvent, 'id'>[] = [];
		recorder = new IncidentRecorder(
			{ append: (events) => output.push(...events), prune: () => {} },
			() => ['private-value'],
		);
		recorder.start();
		recorder.record(
			'console',
			'private-value license:abc discord:123 192.168.1.1',
			{ token: 'hidden', nested: { line: 'steam:abc' } },
		);
		recorder.flush();
		const text = JSON.stringify(output);
		for (const secret of [
			'private-value',
			'license:abc',
			'discord:123',
			'192.168.1.1',
			'hidden',
			'steam:abc',
		])
			expect(text).not.toContain(secret);
	});
	it('bounds bursts and persists a visible gap marker', () => {
		const output: Omit<IncidentEvent, 'id'>[] = [];
		recorder = new IncidentRecorder({
			append: (events) => output.push(...events),
			prune: () => {},
		});
		recorder.start();
		for (let i = 0; i < 2010; i++) recorder.record('console', `Line ${i}`);
		recorder.flush();
		expect(output.filter((event) => event.kind === 'console')).toHaveLength(
			2000,
		);
		expect(output.find((event) => event.kind === 'gap')?.data.dropped).toBe(10);
	});
	it('does not throw into process supervision when storage fails and reports the loss on recovery', () => {
		let fail = false;
		const output: Omit<IncidentEvent, 'id'>[] = [];
		recorder = new IncidentRecorder({
			append: (events) => {
				if (fail) throw new Error('disk full');
				output.push(...events);
			},
			prune: () => {},
		});
		recorder.start();
		fail = true;
		recorder.record('console', 'Lost line');
		recorder.record('console', 'Another lost line');
		expect(() => recorder?.flush()).not.toThrow();
		recorder.flush();
		fail = false;
		recorder.flush();
		expect(output.at(-1)?.kind).toBe('gap');
		expect(output.at(-1)?.data.dropped).toBe(2);
	});
	it('redacts credentials and recursively sanitizes structured values', () => {
		for (const input of [
			'set sv_licenseKey "secret-value"',
			'mysql://user:password@host/database',
			'https://discord.com/api/webhooks/123/secret',
			'Authorization: Bearer private-token',
		]) {
			expect(redactIncidentText(input)).not.toContain('secret');
			expect(redactIncidentText(input)).not.toContain('password');
			expect(redactIncidentText(input)).not.toContain('private-token');
		}
		expect(
			redactIncidentData({
				players: 12,
				playerId: 123,
				nested: { identifiers: ['license:123'] },
			}),
		).toEqual({
			players: 12,
			playerId: '[REDACTED]',
			nested: { identifiers: '[REDACTED]' },
		});
	});
});
