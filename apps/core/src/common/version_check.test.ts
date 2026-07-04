/** biome-ignore-all lint/suspicious/noExplicitAny lint/complexity/noBannedTypes: explicit any allows mocking global fetch frames */
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';
import { checkVersion, createVersionChecker } from './version_check';

describe('Version Checking', () => {
	let originalFetch: typeof globalThis.fetch;

	// Intercept console outputs to prevent polluting the test runner output
	const infoSpy = spyOn(console, 'info').mockImplementation(() => {});
	const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

	// Helper utility to produce a mock successful GitHub API response
	const mockGitHubRelease = (
		tagName: string,
		url = 'https://github.com/mock/release',
	) => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						tag_name: tagName,
						html_url: url,
					}),
					{ status: 200 },
				),
			),
		) as any;
	};

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		infoSpy.mockClear();
		errorSpy.mockClear();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	afterAll(() => {
		infoSpy.mockRestore();
		errorSpy.mockRestore();
	});

	describe('Development Branch Short Circuit', () => {
		it('should immediately exit early with an info message when running a dev-build string context', async () => {
			globalThis.fetch = mock(() => Promise.resolve(new Response())) as any;

			await checkVersion('dev-build');

			expect(infoSpy).toHaveBeenCalledWith(
				'[version] Running in development mode.',
			);
			expect(globalThis.fetch).not.toHaveBeenCalled();
		});
	});

	describe('Beta Testing Tracks', () => {
		it('should log experimental warnings when the current build contains a trailing beta tag', async () => {
			mockGitHubRelease('v1.0.0');

			await checkVersion('v1.0.0-b');

			expect(infoSpy).toHaveBeenCalledWith(
				expect.stringContaining('Currently running a Beta release: v1.0.0-b'),
			);
			expect(infoSpy).toHaveBeenCalledWith(
				expect.stringContaining('Latest stable release is: v1.0.0'),
			);
			expect(infoSpy).toHaveBeenCalledWith(
				expect.stringContaining('Beta builds are experimental'),
			);
		});
	});

	describe('Version Matrix Comparison Outputs', () => {
		it('should correctly flag an outdated build if a newer Major version is detected on remote server', async () => {
			mockGitHubRelease('v2.0.0');

			await checkVersion('v1.5.9');

			expect(infoSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'You are running an outdated version (vv1.5.9), a newer stable version is available: v2.0.0',
				),
			);
		});

		it('should correctly flag an outdated build if a newer Minor version is available', async () => {
			mockGitHubRelease('v1.6.0');

			await checkVersion('v1.5.0');

			expect(infoSpy).toHaveBeenCalledWith(
				expect.stringContaining('a newer stable version is available: v1.6.0'),
			);
		});

		it('should correctly flag an outdated build if a newer Patch revision is discovered', async () => {
			mockGitHubRelease('v1.5.1');

			await checkVersion('v1.5.0');

			expect(infoSpy).toHaveBeenCalledWith(
				expect.stringContaining('a newer stable version is available: v1.5.1'),
			);
		});

		it('should announce that the system is completely up-to-date when version components align exactly', async () => {
			mockGitHubRelease('v1.2.3');

			await checkVersion('v1.2.3');

			expect(infoSpy).toHaveBeenCalledWith(
				'[version] fxManager is up to date (v1.2.3)',
			);
		});

		it('should report a custom/development version when the local runtime is sequentially ahead of remote releases', async () => {
			mockGitHubRelease('v1.0.0');

			await checkVersion('v2.0.0');

			expect(infoSpy).toHaveBeenCalledWith(
				'[version] You are running a development or custom version (v2.0.0)',
			);
		});
	});

	describe('Resiliency & Exception Blocks', () => {
		it('should catch non-ok HTTP status response codes elegantly and route message elements to console.error', async () => {
			globalThis.fetch = mock(() =>
				Promise.resolve(
					new Response('Rate Limit Exceeded', {
						status: 403,
						statusText: 'Forbidden',
					}),
				),
			) as any;

			await checkVersion('v1.0.0');

			expect(errorSpy).toHaveBeenCalledWith(
				'[version] Could not check for updates:',
				'403 - Forbidden',
			);
			expect(infoSpy).not.toHaveBeenCalled();
		});

		it('should handle native system/network connection rejections safely without crashing the parent execution process', async () => {
			globalThis.fetch = mock(() =>
				Promise.reject(new Error('DNS Resolution Timeout')),
			) as any;

			await checkVersion('v1.0.0');

			expect(errorSpy).toHaveBeenCalledWith(
				'[version] Could not check for updates:',
				'DNS Resolution Timeout',
			);
			expect(infoSpy).not.toHaveBeenCalled();
		});
	});
});

describe('createVersionChecker', () => {
	let originalFetch: typeof globalThis.fetch;
	let errorSpy: ReturnType<typeof spyOn>;

	const mockGitHubRelease = (
		tagName: string,
		url = 'https://github.com/mock/release',
	) => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ tag_name: tagName, html_url: url }), {
					status: 200,
				}),
			),
		) as any;
	};

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		errorSpy = spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		errorSpy.mockRestore();
	});

	it('flags an available update and links to the release', async () => {
		mockGitHubRelease('v0.2.2', 'https://github.com/mock/v0.2.2');
		const get = createVersionChecker({ currentVersion: '0.2.1' });

		expect(await get()).toEqual({
			current: '0.2.1',
			latest: 'v0.2.2',
			latestUrl: 'https://github.com/mock/v0.2.2',
			updateAvailable: true,
			isBeta: false,
			isDev: false,
		});
	});

	it('reports no update when already on the latest release', async () => {
		mockGitHubRelease('v0.2.1');
		const get = createVersionChecker({ currentVersion: '0.2.1' });

		expect(await get()).toMatchObject({ updateAvailable: false });
	});

	it('reports no update when ahead of the latest release', async () => {
		mockGitHubRelease('v0.2.1');
		const get = createVersionChecker({ currentVersion: '0.3.0' });

		expect(await get()).toMatchObject({ updateAvailable: false });
	});

	it('never nags a beta build but still surfaces the latest stable', async () => {
		mockGitHubRelease('v0.2.2');
		const get = createVersionChecker({ currentVersion: '0.2.1-b' });

		expect(await get()).toMatchObject({
			isBeta: true,
			updateAvailable: false,
			latest: 'v0.2.2',
		});
	});

	it('short-circuits dev-build without hitting the network', async () => {
		globalThis.fetch = mock(() => Promise.resolve(new Response())) as any;
		const get = createVersionChecker({ currentVersion: 'dev-build' });

		expect(await get()).toMatchObject({ isDev: true, updateAvailable: false });
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('serves a cached value without re-fetching inside the TTL', async () => {
		mockGitHubRelease('v0.2.2');
		const get = createVersionChecker({
			currentVersion: '0.2.1',
			ttlMs: 1000,
			now: () => 0,
		});

		await get();
		await get();

		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it('re-fetches once the TTL has elapsed', async () => {
		mockGitHubRelease('v0.2.2');
		let now = 0;
		const get = createVersionChecker({
			currentVersion: '0.2.1',
			ttlMs: 1000,
			now: () => now,
		});

		await get();
		now = 2000;
		await get();

		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it('falls back to the last cached value when a later fetch fails', async () => {
		mockGitHubRelease('v0.2.2');
		let now = 0;
		const get = createVersionChecker({
			currentVersion: '0.2.1',
			ttlMs: 1000,
			now: () => now,
		});

		expect(await get()).toMatchObject({ updateAvailable: true });

		now = 2000;
		globalThis.fetch = mock(() =>
			Promise.reject(new Error('network down')),
		) as any;

		expect(await get()).toMatchObject({ updateAvailable: true });
	});

	it('returns a safe no-update state when the fetch fails and nothing is cached', async () => {
		globalThis.fetch = mock(() =>
			Promise.reject(new Error('network down')),
		) as any;
		const get = createVersionChecker({ currentVersion: '0.2.1' });

		expect(await get()).toEqual({
			current: '0.2.1',
			latest: null,
			latestUrl: null,
			updateAvailable: false,
			isBeta: false,
			isDev: false,
		});
	});
});
