import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isProduction } from './utils';

/**
 * Manually loads environment variables in `process.env` from the root `.env` file.
 * Used only in development when the runtime is expecting the `.env` file to be in apps/core.
 */

if (!isProduction) {
	const envPath = join(process.cwd(), '../..', '.env');

	if (existsSync(envPath)) {
		const lines = readFileSync(envPath, 'utf-8').split('\n');

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;

			const eq = trimmed.indexOf('=');
			if (eq === -1) continue;

			const key = trimmed.slice(0, eq).trim();
			const value = trimmed
				.slice(eq + 1)
				.trim()
				.replace(/^["']|["']$/g, ''); // Removes quotes

			if (!(key in process.env)) process.env[key] = value;
		}

		console.log(`[core] Loaded .env from ${envPath}.`);
	} else {
		console.log(`[core] No .env found at ${envPath}.`);
	}
}
