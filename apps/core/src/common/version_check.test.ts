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
import { checkVersion } from './version_check';

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
