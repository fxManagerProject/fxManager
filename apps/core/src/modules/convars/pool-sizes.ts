import type {
	PoolSizeLimits,
	PoolSizeOverrides,
} from '@fxmanager/shared/types';

export interface PoolValidationResult {
	valid: PoolSizeOverrides;
	warnings: string[];
}

function isPositiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function parsePoolSizes(
	raw: string | null | undefined,
): PoolSizeOverrides {
	if (!raw) return {};

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {};
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return {};
	}

	const result: PoolSizeOverrides = {};
	for (const [pool, value] of Object.entries(parsed)) {
		if (isPositiveInteger(value)) result[pool] = value;
	}
	return result;
}

export function validatePoolSizes(
	overrides: PoolSizeOverrides,
	limits: PoolSizeLimits,
): PoolValidationResult {
	const valid: PoolSizeOverrides = {};
	const warnings: string[] = [];

	for (const [pool, increase] of Object.entries(overrides)) {
		const max = limits[pool];

		if (max === undefined) {
			warnings.push(
				`Pool "${pool}" is not resizable for the selected game and was skipped.`,
			);
			continue;
		}

		if (increase > max) {
			warnings.push(
				`Pool "${pool}" increase ${increase} exceeds the maximum of ${max} and was skipped.`,
			);
			continue;
		}

		valid[pool] = increase;
	}

	return { valid, warnings };
}

export function buildIncreasePoolSizeArgs(
	overrides: PoolSizeOverrides,
): string[] {
	const args: string[] = [];
	for (const [pool, increase] of Object.entries(overrides)) {
		args.push('+increase_pool_size', pool, String(increase));
	}
	return args;
}
