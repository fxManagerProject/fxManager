import type { ProcessState } from '@fxmanager/shared/types';

export function parseBoolFlag(value: string): boolean {
	return /^(1|true|yes|on)$/i.test(value.trim());
}

// Resolves whether auto-start is enabled.
export function resolveAutostartEnabled(
	dbValue: string | undefined,
	envValue: string | undefined,
): boolean {
	if (dbValue !== undefined && dbValue !== '') return parseBoolFlag(dbValue);
	if (envValue !== undefined && envValue !== '') return parseBoolFlag(envValue);
	return true;
}

// Whether the FXServer should be auto-started at boot.
export function shouldAutostart(params: {
	setupComplete: boolean;
	enabled: boolean;
	status: ProcessState;
}): boolean {
	return (
		params.setupComplete &&
		params.enabled &&
		(params.status === 'stopped' || params.status === 'crashed')
	);
}
