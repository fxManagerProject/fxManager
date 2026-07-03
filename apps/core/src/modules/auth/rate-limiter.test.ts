import { describe, expect, it } from 'bun:test';
import { LoginRateLimiter } from './rate-limiter';

function makeLimiter() {
	let clock = 0;
	const limiter = new LoginRateLimiter({
		maxAttempts: 3,
		lockoutMs: 1000,
		now: () => clock,
	});
	return {
		limiter,
		advance: (ms: number) => {
			clock += ms;
		},
	};
}

describe('LoginRateLimiter', () => {
	it('allows attempts under the threshold', () => {
		const { limiter } = makeLimiter();
		expect(limiter.check('ip').allowed).toBe(true);
		limiter.recordFailure('ip');
		limiter.recordFailure('ip');
		expect(limiter.check('ip').allowed).toBe(true);
	});

	it('locks the key once the threshold is reached', () => {
		const { limiter } = makeLimiter();
		limiter.recordFailure('ip');
		limiter.recordFailure('ip');
		limiter.recordFailure('ip');
		const result = limiter.check('ip');
		expect(result.allowed).toBe(false);
		expect(result.retryAfterMs).toBe(1000);
	});

	it('unlocks after the lockout window elapses', () => {
		const { limiter, advance } = makeLimiter();
		limiter.recordFailure('ip');
		limiter.recordFailure('ip');
		limiter.recordFailure('ip');
		expect(limiter.check('ip').allowed).toBe(false);
		advance(1000);
		expect(limiter.check('ip').allowed).toBe(true);
	});

	it('resets the counter on a successful login', () => {
		const { limiter } = makeLimiter();
		limiter.recordFailure('ip');
		limiter.recordFailure('ip');
		limiter.recordSuccess('ip');
		limiter.recordFailure('ip');
		limiter.recordFailure('ip');
		expect(limiter.check('ip').allowed).toBe(true);
	});

	it('tracks keys independently', () => {
		const { limiter } = makeLimiter();
		limiter.recordFailure('a');
		limiter.recordFailure('a');
		limiter.recordFailure('a');
		expect(limiter.check('a').allowed).toBe(false);
		expect(limiter.check('b').allowed).toBe(true);
	});
});
