import type { ConvarGameType } from '../types/convars';

export const CONVAR_GAME_TYPES = ['fivem', 'redm'] as const;

export const DEFAULT_CONVAR_GAME_TYPE: ConvarGameType = 'fivem';

/**
 * Live pool size limit mirrors. Pool names and their maximum increases are
 * fetched from here on startup so limites are always up-to-date.
 */
export const POOL_LIMIT_URLS: Record<ConvarGameType, string> = {
	fivem: 'https://content.cfx.re/mirrors/client/pool-size-limits/fivem.json',
	redm: 'https://content.cfx.re/mirrors/client/pool-size-limits/redm.json',
};

export const CONVARS_SETTINGS_KEYS = {
	gameType: 'convars.gameType',
	poolSizes: 'convars.poolSizes',
	anticheat: 'convars.anticheat',
} as const;
