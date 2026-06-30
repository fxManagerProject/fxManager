const JGSCRIPTS_API = 'https://artifacts.jgscripts.com/jsonv2';
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;

interface JgScriptsResponse {
	recommendedArtifact?: string;
}

export function createRecommendedArtifactFetcher(opts?: {
	ttlMs?: number;
	now?: () => number;
}) {
	const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
	const now = opts?.now ?? Date.now;
	let cache: { value: string; expiresAt: number } | null = null;

	return async function getRecommendedArtifact(): Promise<string | null> {
		if (cache && cache.expiresAt > now()) return cache.value;

		try {
			const response = await fetch(JGSCRIPTS_API, {
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});

			if (!response.ok)
				throw new Error(`${response.status} - ${response.statusText}`);

			const data = (await response.json()) as JgScriptsResponse;
			if (!data.recommendedArtifact) return cache?.value ?? null;

			cache = { value: data.recommendedArtifact, expiresAt: now() + ttlMs };
			return cache.value;
		} catch (err) {
			console.error(
				`[artifact] Could not fetch recommended artifact:`,
				(err as Error).message,
			);
			return cache?.value ?? null;
		}
	};
}

export const getRecommendedArtifact = createRecommendedArtifactFetcher();
