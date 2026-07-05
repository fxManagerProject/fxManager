import type { ConvarGameType, PoolSizeLimits } from '@fxmanager/shared/types';
import { POOL_LIMIT_URLS } from '@fxmanager/shared/constants';

export type LimitsFetcher = (url: string) => Promise<unknown>;

export interface PoolLimitsManagerOptions {
	ttlMs?: number;
	now?: () => number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

export function parsePoolLimits(payload: unknown): PoolSizeLimits {
	if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
		throw new Error('Pool size limits payload is not an object');
	}

	const limits: PoolSizeLimits = {};
	for (const [pool, value] of Object.entries(payload)) {
		if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
			limits[pool] = value;
		}
	}
	return limits;
}

interface CacheEntry {
	limits: PoolSizeLimits;
	fetchedAt: number;
}

export class PoolLimitsManager {
	private readonly cache = new Map<ConvarGameType, CacheEntry>();
	private readonly ttlMs: number;
	private readonly now: () => number;

	constructor(
		private readonly fetcher: LimitsFetcher,
		opts?: PoolLimitsManagerOptions,
	) {
		this.ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
		this.now = opts?.now ?? Date.now;
	}

	async getLimits(
		game: ConvarGameType,
		opts?: { forceRefresh?: boolean },
	): Promise<PoolSizeLimits> {
		const cached = this.cache.get(game);
		const isFresh = cached !== undefined && this.now() - cached.fetchedAt < this.ttlMs;

		if (cached && isFresh && !opts?.forceRefresh) {
			return cached.limits;
		}

		try {
			const payload = await this.fetcher(POOL_LIMIT_URLS[game]);
			const limits = parsePoolLimits(payload);
			this.cache.set(game, { limits, fetchedAt: this.now() });
			return limits;
		} catch (err) {
			if (cached) return cached.limits;
			throw err;
		}
	}
}

export const defaultLimitsFetcher: LimitsFetcher = async (url) => {
	const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (!res.ok) {
		throw new Error(
			`Failed to fetch pool size limits: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
};

export const poolLimits = new PoolLimitsManager(defaultLimitsFetcher);
