import type { PlayerActionPayload } from '@common/types';

export function isPlayerAction(value: unknown): value is PlayerActionPayload {
	if (!value || typeof value !== 'object') return false;
	const data = value as Record<string, unknown>;
	return (
		Number.isSafeInteger(data.playerId) &&
		Number(data.playerId) > 0 &&
		Number.isSafeInteger(data.target) &&
		Number(data.target) >= 0 &&
		typeof data.action === 'string' &&
		['warn', 'kick', 'ban'].includes(data.action) &&
		typeof data.reason === 'string' &&
		data.reason.trim().length > 0 &&
		data.reason.length <= 500 &&
		(data.durationSeconds === undefined ||
			(data.action === 'ban' &&
				Number.isSafeInteger(data.durationSeconds) &&
				Number(data.durationSeconds) >= 0 &&
				Number(data.durationSeconds) <= 31536000))
	);
}
