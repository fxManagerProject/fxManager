interface LimiterOptions {
	maxAttempts?: number;
	lockoutMs?: number;
	now?: () => number;
}

interface AttemptState {
	count: number;
	lockedUntil: number;
}

export class LoginRateLimiter {
	private readonly attempts = new Map<string, AttemptState>();
	private readonly maxAttempts: number;
	private readonly lockoutMs: number;
	private readonly now: () => number;

	constructor(options: LimiterOptions = {}) {
		this.maxAttempts = options.maxAttempts ?? 5;
		this.lockoutMs = options.lockoutMs ?? 15 * 60 * 1000;
		this.now = options.now ?? Date.now;
	}

	check(key: string): { allowed: boolean; retryAfterMs: number } {
		const state = this.attempts.get(key);
		if (state && state.lockedUntil > this.now()) {
			return { allowed: false, retryAfterMs: state.lockedUntil - this.now() };
		}
		return { allowed: true, retryAfterMs: 0 };
	}

	recordFailure(key: string): void {
		const now = this.now();
		const state = this.attempts.get(key) ?? { count: 0, lockedUntil: 0 };

		if (state.lockedUntil && state.lockedUntil <= now) {
			state.count = 0;
			state.lockedUntil = 0;
		}

		state.count += 1;
		if (state.count >= this.maxAttempts) {
			state.lockedUntil = now + this.lockoutMs;
			state.count = 0;
		}

		this.attempts.set(key, state);
	}

	recordSuccess(key: string): void {
		this.attempts.delete(key);
	}
}

export const loginRateLimiter = new LoginRateLimiter();
