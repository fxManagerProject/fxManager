export type ConvarGameType = 'fivem' | 'redm';

/** Map of pool name to the maximum allowed size increase, fetched live from cfx.re. */
export type PoolSizeLimits = Record<string, number>;

/** Map of pool name to the size increase the user configured. */
export type PoolSizeOverrides = Record<string, number>;

export interface ConvarPoolConfig {
	gameType: ConvarGameType;
	poolSizes: PoolSizeOverrides;
}
