import { RESTRICTED_STARTUP_ARGUMENTS } from '../constants';

export type ValidationResult =
	| { valid: true }
	| { valid: false; argument: string };

/**
 * Validates the given string for restricted startup arguments and, if invalid, returns the first invalid argument.
 * @param value String of arguments to validate.
 * @returns `true` if valid, otherwise the first invalid argument.
 */
export function validateStartupArguments(value: string): ValidationResult {
	if (!value) return { valid: true };

	const args = value.match(/(?:\+|--)\S+(?:\s+(?!(?:\+|--))\S+)*/g) ?? [];
	const restricted = args.find((arg) =>
		RESTRICTED_STARTUP_ARGUMENTS.some((patt) => patt.test(arg)),
	);

	if (!restricted) return { valid: true };

	return { valid: false, argument: restricted };
}
