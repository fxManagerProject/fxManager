import type { Contributor, ContributorSummary } from '@fxmanager/shared/types';
import { isProduction } from './utils';

const GITHUB_CONTRIBUTORS =
	'https://api.github.com/repos/fxManagerProject/fxManager/contributors';
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_TIMEOUT_MS = 5_000;

interface RawContributor {
	id: number;
	login: string;
	node_id: string;
	avatar_url: string;
	gravatar_id: string;
	url: string;
	html_url: string;
	followers_url: string;
	following_url: string;
	gists_url: string;
	starred_url: string;
	subscriptions_url: string;
	organizations_url: string;
	repos_url: string;
	events_url: string;
	received_events_url: string;
	type: string;
	user_view_type: string;
	site_admin: boolean;
	contributions: number;
}

export const CORE_CONTRIBUTORS: Record<string, Contributor> = {
	Maximus7474: {
		kofi: 'Maximus7474',
		username: 'Maximus7474',
	},
	FjamZoo: {
		kofi: 'FjamZoo',
		username: 'FjamZoo',
	},
	andreutu: {
		username: 'andreutu',
	},
};

async function fetchContributors(): Promise<RawContributor[]> {
	const response = await fetch(GITHUB_CONTRIBUTORS, {
		headers: { 'User-Agent': 'fxManager-Updater' },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!response.ok)
		throw new Error(`${response.status} - ${response.statusText}`);

	const data = (await response.json()) as RawContributor[];

	return data;
}

/**
 * TTL-cached version status provider for the API/UI. Mirrors the
 * recommended-artifact fetcher: caches success, falls back to the last known
 * value (or a safe "no update" state) on failure so it never blocks callers.
 */
export function createContributorsList(opts: {
	ttlMs?: number;
	now?: () => number;
	isProd: boolean;
}) {
	const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
	const now = opts?.now ?? Date.now;
	let cache: { value: ContributorSummary; expiresAt: number } | null = null;

	const noUpdate = (): ContributorSummary => ({
		core: Object.values(CORE_CONTRIBUTORS),
		external: [],
	});

	return async function getContributors(): Promise<ContributorSummary> {
		if (!opts.isProd) return noUpdate();
		if (cache && cache.expiresAt > now()) return cache.value;

		try {
			const data = await fetchContributors();

			const value: ContributorSummary = {
				core: [],
				external: [],
			};

			for (const contributor of data) {
				if (CORE_CONTRIBUTORS[contributor.login]) {
					value.core.push({
						...CORE_CONTRIBUTORS[contributor.login],
						username: contributor.login,
						image: contributor.avatar_url,
						contributions: contributor.contributions,
					});
				} else if (contributor.type === 'User') {
					value.external.push({
						username: contributor.login,
						image: contributor.avatar_url,
						contributions: contributor.contributions,
					});
				}
			}

			cache = { value, expiresAt: now() + ttlMs };
			return value;
		} catch (err) {
			console.error(
				`[version] Could not fetch contributors:`,
				(err as Error).message,
			);
			return cache?.value ?? noUpdate();
		}
	};
}

export const getContributorsList = createContributorsList({
	isProd: isProduction,
});
