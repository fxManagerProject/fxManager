import { describe, expect, it } from 'bun:test';
import { POOL_LIMIT_URLS } from '@fxmanager/shared/constants';
import { PoolLimitsManager, parsePoolLimits } from './pool-limits';

describe('parsePoolLimits', () => {
	it('keeps positive integer limits', () => {
		expect(parsePoolLimits({ TxdStore: 50000, CMoveObject: 600 })).toEqual({
			TxdStore: 50000,
			CMoveObject: 600,
		});
	});

	it('drops entries that are not positive integers', () => {
		expect(
			parsePoolLimits({ A: -1, B: 'x', C: 1.5, D: 100, E: 0 }),
		).toEqual({ D: 100 });
	});

	it('throws when the payload is not an object', () => {
		expect(() => parsePoolLimits(null)).toThrow();
		expect(() => parsePoolLimits([])).toThrow();
		expect(() => parsePoolLimits(5)).toThrow();
	});
});

describe('PoolLimitsManager', () => {
	function makeFetcher(payload: unknown) {
		const calls: string[] = [];
		const fetcher = async (url: string) => {
			calls.push(url);
			return payload;
		};
		return { fetcher, calls };
	}

	it('fetches limits from the url for the requested game', async () => {
		const { fetcher, calls } = makeFetcher({ TxdStore: 50000 });
		const manager = new PoolLimitsManager(fetcher);

		const limits = await manager.getLimits('fivem');

		expect(limits).toEqual({ TxdStore: 50000 });
		expect(calls).toEqual([POOL_LIMIT_URLS.fivem]);
	});

	it('serves subsequent calls from cache within the TTL', async () => {
		const { fetcher, calls } = makeFetcher({ TxdStore: 50000 });
		const manager = new PoolLimitsManager(fetcher, { ttlMs: 1000, now: () => 0 });

		await manager.getLimits('fivem');
		await manager.getLimits('fivem');

		expect(calls).toHaveLength(1);
	});

	it('refetches when forceRefresh is set', async () => {
		const { fetcher, calls } = makeFetcher({ TxdStore: 50000 });
		const manager = new PoolLimitsManager(fetcher, { ttlMs: 1000, now: () => 0 });

		await manager.getLimits('fivem');
		await manager.getLimits('fivem', { forceRefresh: true });

		expect(calls).toHaveLength(2);
	});

	it('refetches after the TTL expires', async () => {
		let clock = 0;
		const { fetcher, calls } = makeFetcher({ TxdStore: 50000 });
		const manager = new PoolLimitsManager(fetcher, {
			ttlMs: 1000,
			now: () => clock,
		});

		await manager.getLimits('fivem');
		clock = 1500;
		await manager.getLimits('fivem');

		expect(calls).toHaveLength(2);
	});

	it('falls back to the last good value when a refetch fails', async () => {
		let shouldThrow = false;
		const fetcher = async () => {
			if (shouldThrow) throw new Error('network down');
			return { TxdStore: 50000 };
		};
		const manager = new PoolLimitsManager(fetcher, { ttlMs: 0, now: () => 0 });

		const first = await manager.getLimits('fivem');
		shouldThrow = true;
		const second = await manager.getLimits('fivem');

		expect(first).toEqual({ TxdStore: 50000 });
		expect(second).toEqual({ TxdStore: 50000 });
	});

	it('throws when the fetch fails and there is no cached value', async () => {
		const fetcher = async () => {
			throw new Error('network down');
		};
		const manager = new PoolLimitsManager(fetcher);

		await expect(manager.getLimits('redm')).rejects.toThrow('network down');
	});
});
