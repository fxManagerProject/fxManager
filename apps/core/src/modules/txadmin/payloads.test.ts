import { describe, expect, it } from 'bun:test';
import {
	buildBannedPayload,
	buildWarnedPayload,
	identifiersToTxIds,
} from './payloads';

describe('identifiersToTxIds', () => {
	it('returns the prefixed identifier strings', () => {
		expect(
			identifiersToTxIds({
				license: 'license:abc',
				discord: 'discord:123',
			}),
		).toEqual(['license:abc', 'discord:123']);
	});

	it('drops empty and missing identifiers', () => {
		expect(identifiersToTxIds({ license: 'license:abc', steam: '' })).toEqual([
			'license:abc',
		]);
	});

	it('returns an empty array when no identifiers are known', () => {
		expect(identifiersToTxIds(undefined)).toEqual([]);
	});
});

describe('buildBannedPayload', () => {
	const base = {
		author: 'Maximus',
		reason: 'cheating',
		banId: 42,
		targetNetId: 7,
		targetName: 'Bob',
		identifiers: { license: 'license:abc' },
		kickMessage: 'You are banned',
	};

	it('encodes a temporary ban expiry as unix seconds', () => {
		const payload = buildBannedPayload({
			...base,
			expiresAt: new Date('2030-01-01T00:00:00.000Z'),
		});

		expect(payload.expiration).toBe(1893456000);
		expect(payload.actionId).toBe('42');
		expect(payload.targetIds).toEqual(['license:abc']);
		expect(payload.targetHwids).toEqual([]);
		expect(payload.targetNetId).toBe(7);
		expect(payload.kickMessage).toBe('You are banned');
	});

	it('encodes a permanent ban expiry as false', () => {
		const payload = buildBannedPayload({ ...base, expiresAt: null });
		expect(payload.expiration).toBe(false);
	});

	it('uses a null targetNetId for an offline ban', () => {
		const payload = buildBannedPayload({
			...base,
			expiresAt: null,
			targetNetId: null,
		});
		expect(payload.targetNetId).toBeNull();
	});

	it('falls back to an empty action id when none is available', () => {
		const payload = buildBannedPayload({
			...base,
			banId: undefined,
			expiresAt: null,
		});
		expect(payload.actionId).toBe('');
	});
});

describe('buildWarnedPayload', () => {
	it('builds the warned payload with a stringified action id', () => {
		const payload = buildWarnedPayload({
			author: 'Maximus',
			reason: 'spam',
			warnId: 9,
			targetNetId: null,
			targetName: 'Bob',
			identifiers: { license: 'license:abc', discord: 'discord:1' },
		});

		expect(payload.actionId).toBe('9');
		expect(payload.targetIds).toEqual(['license:abc', 'discord:1']);
		expect(payload.targetNetId).toBeNull();
		expect(payload.targetName).toBe('Bob');
	});
});
