import type { ConvarDef, ConvarOverrides } from '@fxmanager/shared/types';

export interface ConvarValidationResult {
	valid: ConvarOverrides;
	warnings: string[];
}

/**
 * Parse a stored convar-overrides JSON blob into a `{ convar: value }` map,
 * keeping only string values. Anything malformed collapses to an empty map.
 */
export function parseConvarOverrides(
	raw: string | null | undefined,
): ConvarOverrides {
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

	const result: ConvarOverrides = {};
	for (const [name, value] of Object.entries(parsed)) {
		if (typeof value === 'string') result[name] = value;
	}
	return result;
}

export function isValidConvarValue(def: ConvarDef, value: string): boolean {
	switch (def.control.kind) {
		case 'boolean':
			return value === 'true' || value === 'false';
		case 'enum':
			return def.control.options.some((option) => option.value === value);
		case 'number': {
			const n = Number(value);
			if (!Number.isInteger(n)) return false;
			if (n < def.control.min) return false;
			if (def.control.max !== undefined && n > def.control.max) return false;
			return true;
		}
		case 'text': {
			if (value.length === 0) return false;
			if (
				def.control.maxLength !== undefined &&
				value.length > def.control.maxLength
			) {
				return false;
			}
			return true;
		}
	}
}

/**
 * Validate stored overrides against the known convar definitions. Unknown
 * convars or invalid values are dropped and reported as warnings.
 */
export function validateConvarOverrides(
	overrides: ConvarOverrides,
	defs: ConvarDef[],
): ConvarValidationResult {
	const byName = new Map(defs.map((def) => [def.name, def]));
	const valid: ConvarOverrides = {};
	const warnings: string[] = [];

	for (const [name, value] of Object.entries(overrides)) {
		const def = byName.get(name);
		if (!def) {
			warnings.push(`Unknown convar "${name}" was skipped.`);
			continue;
		}
		if (!isValidConvarValue(def, value)) {
			warnings.push(`Invalid value "${value}" for "${name}" was skipped.`);
			continue;
		}
		valid[name] = value;
	}

	return { valid, warnings };
}

/**
 * Build the `+set` / `+setr` / `+sets` startup args for configured convars, in
 * definition order. Only known convars with valid values are injected, so
 * nothing is applied unless the user explicitly set it.
 */
export function buildConvarArgs(
	overrides: ConvarOverrides,
	defs: ConvarDef[],
): string[] {
	const args: string[] = [];
	for (const def of defs) {
		const value = overrides[def.name];
		if (value === undefined || !isValidConvarValue(def, value)) continue;
		// Text values may contain newlines; escape them for the command line
		// exactly like FXServer/txAdmin expect (\n -> literal \\n).
		const arg =
			def.control.kind === 'text' ? value.replaceAll('\n', '\\n') : value;
		args.push(`+${def.setter}`, def.name, arg);
	}
	return args;
}
