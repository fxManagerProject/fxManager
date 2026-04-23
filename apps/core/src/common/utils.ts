import { repo } from '@fxmanager/database';
import { randomBytes } from 'node:crypto';

export const isProduction = process.env.NODE_ENV === 'production';
export const COOKIE_NAME = 'fxm_session';

export function isFxManagerSetup() {
	return repo.auth.countUsers() > 0;
}

export function generatePassword(length: number = 20): string {
	const charset =
		'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
	let password = '';

	const bytes = randomBytes(length);

	for (const byte of bytes) {
		password += charset[byte % charset.length];
	}

	return password;
}
