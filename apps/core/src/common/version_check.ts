const GITHUB_LATEST_RELEASE =
	'https://api.github.com/repos/fxManagerProject/fxManager/releases/latest';
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;

export interface VersionStatus {
	current: string;
	latest: string | null;
	latestUrl: string | null;
	updateAvailable: boolean;
	isBeta: boolean;
	isDev: boolean;
}

interface GitHubRelease {
	tag_name: string;
	html_url: string;
}

export function getCurrentVersion(): string {
	return process.env.VERSION ?? 'dev-build';
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
	const response = await fetch(GITHUB_LATEST_RELEASE, {
		headers: { 'User-Agent': 'fxManager-Updater' },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!response.ok)
		throw new Error(`${response.status} - ${response.statusText}`);

	const data = (await response.json()) as GitHubRelease & {
		[key: string]: unknown;
	};

	return { tag_name: data.tag_name, html_url: data.html_url };
}

function compareVersions(current: string, latest: string): number {
	const parse = (v: string) => {
		const [main, tag] = v.replace('v', '').split('-') as [
			`${number}.${number}.${number}`,
			'b' | undefined,
		];
		const parts = main.split('.').map(Number);

		return {
			major: parts[0] ?? 0,
			minor: parts[1] ?? 0,
			patch: parts[2] ?? 0,
			isBeta: tag === 'b',
		};
	};

	const c = parse(current);
	const l = parse(latest);

	if (c.major !== l.major) return l.major - c.major > 0 ? 1 : -1;
	if (c.minor !== l.minor) return l.minor - c.minor > 0 ? 1 : -1;
	if (c.patch !== l.patch) return l.patch - c.patch > 0 ? 1 : -1;

	if (c.isBeta && !l.isBeta) return 1;
	if (!c.isBeta && l.isBeta) return -1;

	return 0;
}

/**
 * TTL-cached version status provider for the API/UI. Mirrors the
 * recommended-artifact fetcher: caches success, falls back to the last known
 * value (or a safe "no update" state) on failure so it never blocks callers.
 */
export function createVersionChecker(opts?: {
	currentVersion?: string;
	ttlMs?: number;
	now?: () => number;
}) {
	const currentVersion = opts?.currentVersion ?? getCurrentVersion();
	const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
	const now = opts?.now ?? Date.now;
	const isDev = currentVersion === 'dev-build';
	const isBeta = !isDev && currentVersion.includes('-b');
	let cache: { value: VersionStatus; expiresAt: number } | null = null;

	const noUpdate = (): VersionStatus => ({
		current: currentVersion,
		latest: null,
		latestUrl: null,
		updateAvailable: false,
		isBeta,
		isDev,
	});

	return async function getVersionStatus(): Promise<VersionStatus> {
		if (isDev) return noUpdate();
		if (cache && cache.expiresAt > now()) return cache.value;

		try {
			const { tag_name, html_url } = await fetchLatestRelease();

			const value: VersionStatus = {
				current: currentVersion,
				latest: tag_name,
				latestUrl: html_url,
				updateAvailable: !isBeta && compareVersions(currentVersion, tag_name) === 1,
				isBeta,
				isDev,
			};

			cache = { value, expiresAt: now() + ttlMs };
			return value;
		} catch (err) {
			console.error(
				`[version] Could not check for updates:`,
				(err as Error).message,
			);
			return cache?.value ?? noUpdate();
		}
	};
}

export const getVersionStatus = createVersionChecker();

export async function checkVersion(currentVersion: string) {
	if (currentVersion === 'dev-build') {
		console.info(`[version] Running in development mode.`);
		return;
	}

	try {
		const { tag_name: latestVersion, html_url: releaseUrl } =
			await fetchLatestRelease();

		const comparison = compareVersions(currentVersion, latestVersion);
		const isCurrentBeta = currentVersion.includes('-b');

		if (isCurrentBeta) {
			console.info(
				`[version] Currently running a Beta release: ${currentVersion}`,
			);
			console.info(`[version] Latest stable release is: ${latestVersion}`);
			console.info(
				`[version] Beta builds are experimental and may contain breaking changes.`,
			);
			console.info(`[version] Check for stable updates at: ${releaseUrl}\n`);
			return;
		}

		if (comparison === 1) {
			console.info(
				`[version] You are running an outdated version (v${currentVersion}), a newer stable version is available: ${latestVersion}`,
			);
			console.info(
				`[version] It is highly recommended to update to maintain stability.`,
			);
			console.info(`[version] Download: ${releaseUrl}\n`);
		} else if (comparison === 0) {
			console.info(`[version] fxManager is up to date (${currentVersion})`);
		} else {
			console.info(
				`[version] You are running a development or custom version (${currentVersion})`,
			);
		}
	} catch (err) {
		console.error(
			`[version] Could not check for updates:`,
			(err as Error).message,
		);
	}
}
