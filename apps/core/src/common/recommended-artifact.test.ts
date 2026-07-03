import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';
import { createRecommendedArtifactFetcher } from './recommended-artifact';

describe('createRecommendedArtifactFetcher', () => {
	let originalFetch: typeof globalThis.fetch;
	const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

	const mockJsonV2 = (recommendedArtifact: string) => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ recommendedArtifact }), { status: 200 }),
			),
		) as unknown as typeof globalThis.fetch;
	};

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		errorSpy.mockClear();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('fetches and returns the recommended artifact build', async () => {
		mockJsonV2('31725');
		const get = createRecommendedArtifactFetcher();

		expect(await get()).toBe('31725');
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it('serves a cached value without re-fetching inside the TTL', async () => {
		mockJsonV2('31725');
		const get = createRecommendedArtifactFetcher({ ttlMs: 1000, now: () => 0 });

		await get();
		await get();

		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it('re-fetches once the TTL has elapsed', async () => {
		mockJsonV2('31725');
		let now = 0;
		const get = createRecommendedArtifactFetcher({
			ttlMs: 1000,
			now: () => now,
		});

		await get();
		now = 2000;
		await get();

		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it('returns null when the fetch fails and nothing is cached', async () => {
		globalThis.fetch = mock(() =>
			Promise.reject(new Error('network down')),
		) as unknown as typeof globalThis.fetch;
		const get = createRecommendedArtifactFetcher();

		expect(await get()).toBeNull();
	});

	it('falls back to the last cached value when a later fetch fails', async () => {
		mockJsonV2('31725');
		let now = 0;
		const get = createRecommendedArtifactFetcher({
			ttlMs: 1000,
			now: () => now,
		});

		expect(await get()).toBe('31725');

		now = 2000;
		globalThis.fetch = mock(() =>
			Promise.reject(new Error('network down')),
		) as unknown as typeof globalThis.fetch;

		expect(await get()).toBe('31725');
	});
});
