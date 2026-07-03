import crypto from 'node:crypto';

class SetupTokenManager {
	private token: string | null = null;

	ensure(): string {
		if (!this.token) this.token = crypto.randomUUID();
		return this.token;
	}

	get(): string | null {
		return this.token;
	}

	validate(candidate: unknown): boolean {
		if (!this.token || typeof candidate !== 'string') return false;

		const expected = Buffer.from(this.token);
		const actual = Buffer.from(candidate);
		if (expected.length !== actual.length) return false;

		return crypto.timingSafeEqual(expected, actual);
	}

	clear(): void {
		this.token = null;
	}
}

export const setupTokenManager = new SetupTokenManager();
