import { describe, expect, test } from 'bun:test';
import { isPlayerAction } from './validation';
describe('player moderation input', () => {
	test('accepts supported actions and explicit permanent bans', () => {
		for (const action of ['warn', 'kick', 'ban'])
			expect(
				isPlayerAction({
					playerId: 44,
					target: 12,
					action,
					reason: 'Rule violation',
				}),
			).toBe(true);
		expect(
			isPlayerAction({
				playerId: 44,
				target: 12,
				action: 'ban',
				reason: 'Rule violation',
				durationSeconds: 0,
			}),
		).toBe(true);
	});
	test('rejects malformed targets, actions, reasons, and durations', () => {
		for (const payload of [
			null,
			{ playerId: 0 },
			{ playerId: '44' },
			{ target: '12' },
			{ target: -1 },
			{ target: 1.5 },
			{ action: 'stop' },
			{ reason: '  ' },
			{ reason: 'a'.repeat(501) },
			{ durationSeconds: -1 },
			{ durationSeconds: NaN },
			{ durationSeconds: 31536001 },
			{ action: 'warn', durationSeconds: 10 },
		]) {
			expect(
				isPlayerAction(
					payload === null
						? null
						: {
								playerId: 44,
								target: 12,
								action: 'ban',
								reason: 'Rule violation',
								...payload,
							},
				),
			).toBe(false);
		}
	});
});
