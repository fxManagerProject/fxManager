import os from 'os';
import { randomBytes } from 'node:crypto';
import { repo } from '@fxmanager/database';
import { access } from 'node:fs/promises';

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

export function getIp(): string {
	const interfaces = os.networkInterfaces();
	for (const interfaceName in interfaces) {
		const addresses = interfaces[interfaceName];
		if (!addresses) continue;

		for (const addr of addresses) {
			if (addr.family === 'IPv4' && !addr.internal) {
				return addr.address;
			}
		}
	}
	return '127.0.0.1';
}

export async function fileExists(target: string): Promise<boolean> {
	try {
		await access(target);
		return true;
	} catch {
		return false;
	}
}
