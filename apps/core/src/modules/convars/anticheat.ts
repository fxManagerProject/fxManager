import type {
	AnticheatConvarDef,
	AnticheatOverrides,
} from '@fxmanager/shared/types';

export interface AnticheatValidationResult {
	valid: AnticheatOverrides;
	warnings: string[];
}

/**
 * Parse the stored `convars.anticheat` JSON into a `{ convar: value }` map,
 * keeping only string values. Anything malformed collapses to an empty map.
 */
export function parseAnticheatOverrides(
	raw: string | null | undefined,
): AnticheatOverrides {
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

	const result: AnticheatOverrides = {};
	for (const [name, value] of Object.entries(parsed)) {
		if (typeof value === 'string') result[name] = value;
	}
	return result;
}

export function isValidAnticheatValue(
	def: AnticheatConvarDef,
	value: string,
): boolean {
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
	}
}

/**
 * Validate stored overrides against the known convar definitions. Unknown
 * convars or invalid values are dropped and reported as warnings.
 */
export function validateAnticheatOverrides(
	overrides: AnticheatOverrides,
	defs: AnticheatConvarDef[],
): AnticheatValidationResult {
	const byName = new Map(defs.map((def) => [def.name, def]));
	const valid: AnticheatOverrides = {};
	const warnings: string[] = [];

	for (const [name, value] of Object.entries(overrides)) {
		const def = byName.get(name);
		if (!def) {
			warnings.push(`Unknown anticheat convar "${name}" was skipped.`);
			continue;
		}
		if (!isValidAnticheatValue(def, value)) {
			warnings.push(
				`Invalid value "${value}" for "${name}" was skipped.`,
			);
			continue;
		}
		valid[name] = value;
	}

	return { valid, warnings };
}

/**
 * Build the `+set` / `+setr` startup args for configured anticheat convars, in
 * definition order. Only known convars with valid values are injected, so
 * nothing is applied unless the user explicitly set it.
 */
export function buildAnticheatArgs(
	overrides: AnticheatOverrides,
	defs: AnticheatConvarDef[],
): string[] {
	const args: string[] = [];
	for (const def of defs) {
		const value = overrides[def.name];
		if (value === undefined || !isValidAnticheatValue(def, value)) continue;
		args.push(`+${def.setter}`, def.name, value);
	}
	return args;
}
