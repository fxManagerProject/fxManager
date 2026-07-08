/** biome-ignore-all lint/suspicious/noExplicitAny lint/complexity/noBannedTypes: explicit any allows mocking global fetch frames */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';
import { createContributorsList } from './contributors';

describe('createContributorsList', () => {
	let originalFetch: typeof globalThis.fetch;
	let errorSpy: ReturnType<typeof spyOn>;

	// Helper to mock successful GitHub Contributors responses
	const mockGitHubContributors = (contributors: any[], status = 200) => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify(contributors), {
					status,
					statusText: status === 200 ? 'OK' : 'Internal Server Error',
				}),
			),
		) as any;
	};

	// Helper data fixtures
	const mockRawCore = {
		id: 1,
		login: 'Maximus7474',
		avatar_url: 'https://avatar.com/max',
		type: 'User',
		contributions: 42,
	};

	const mockRawExternal = {
		id: 2,
		login: 'GhostCoder',
		avatar_url: 'https://avatar.com/ghost',
		type: 'User',
		contributions: 10,
	};

	const mockRawBot = {
		id: 3,
		login: 'dependabot[bot]',
		avatar_url: 'https://avatar.com/bot',
		type: 'Bot',
		contributions: 100,
	};

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		errorSpy = spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		errorSpy.mockRestore();
	});

	it('should return a default core list when NOT in production', async () => {
		globalThis.fetch = mock(() => Promise.resolve(new Response('[]'))) as any;

		const getContributors = createContributorsList({ isProd: false });
		const result = await getContributors();

		expect(result.core).toHaveLength(3);
		expect(globalThis.fetch).toBeCalledTimes(0);
	});

	it('should correctly filter and map core vs external vs bot contributors', async () => {
		mockGitHubContributors([mockRawCore, mockRawExternal, mockRawBot]);
		const getContributors = createContributorsList({ isProd: true });

		const result = await getContributors();

		// Check Core matching
		expect(result.core).toHaveLength(1);
		expect(result.core[0]).toEqual({
			kofi: 'Maximus7474',
			username: 'Maximus7474',
			image: 'https://avatar.com/max',
			contributions: 42,
		});

		// Check External matching
		expect(result.external).toHaveLength(1);
		expect(result.external[0]).toEqual({
			username: 'GhostCoder',
			image: 'https://avatar.com/ghost',
			contributions: 10,
		});

		// Bots should be skipped entirely
		const allReturnedLogins = [
			...result.core.map((c) => c.username),
			...result.external.map((c) => c.username),
		];
		expect(allReturnedLogins).not.toContain('dependabot[bot]');
	});

	it('should use cached value and avoid network calls before TTL expires', async () => {
		let mockTime = 1000;
		const timeMock = () => mockTime;

		mockGitHubContributors([mockRawCore]);
		const getContributors = createContributorsList({
			isProd: true,
			ttlMs: 5000,
			now: timeMock,
		});

		// First call hits the network
		const firstResult = await getContributors();
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);

		// Second call within TTL returns cached data without calling fetch again
		mockTime = 4000; // +3000ms elapsed (TTL is 5000)
		const secondResult = await getContributors();
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
		expect(secondResult).toEqual(firstResult);
	});

	it('should refresh from network after TTL expires', async () => {
		let mockTime = 1000;
		const timeMock = () => mockTime;

		mockGitHubContributors([mockRawCore]);
		const getContributors = createContributorsList({
			isProd: true,
			ttlMs: 5000,
			now: timeMock,
		});

		await getContributors(); // Fetch #1

		// Advance time past expiration
		mockTime = 7000; // +6000ms elapsed
		await getContributors(); // Fetch #2

		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it('should gracefully return fallback empty arrays if first network request fails', async () => {
		mockGitHubContributors([], 500);
		const getContributors = createContributorsList({ isProd: true });

		const result = await getContributors();

		expect(errorSpy).toHaveBeenCalled();
		expect(result.core).toHaveLength(3); // Hardcoded fallback defaults
		expect(result.external).toHaveLength(0);
	});

	it('should fall back to last known cached values if network request fails after a success', async () => {
		let mockTime = 1000;
		const timeMock = () => mockTime;

		mockGitHubContributors([mockRawExternal]);
		const getContributors = createContributorsList({
			isProd: true,
			ttlMs: 1000,
			now: timeMock,
		});

		await getContributors();

		mockTime = 3000;
		mockGitHubContributors([], 500);

		const fallbackResult = await getContributors();

		expect(errorSpy).toHaveBeenCalled();
		expect(fallbackResult.external).toHaveLength(1);
		expect(fallbackResult.external?.[0]?.username).toBe('GhostCoder');
	});
});
