import { repo } from '@fxmanager/database';
import {
	CONVAR_GAME_TYPES,
	CONVARS_SETTINGS_KEYS,
	DEFAULT_CONVAR_GAME_TYPE,
} from '@fxmanager/shared/constants';
import type {
	ConvarGameType,
	ConvarPoolConfig,
	PoolSizeOverrides,
} from '@fxmanager/shared/types';
import { parsePoolSizes } from './pool-sizes';

export function isConvarGameType(value: unknown): value is ConvarGameType {
	return (
		typeof value === 'string' &&
		(CONVAR_GAME_TYPES as readonly string[]).includes(value)
	);
}

export function getStoredGameType(): ConvarGameType {
	const raw = repo.settings.get<string>(CONVARS_SETTINGS_KEYS.gameType);
	return isConvarGameType(raw) ? raw : DEFAULT_CONVAR_GAME_TYPE;
}

export function getStoredPoolConfig(): ConvarPoolConfig {
	return {
		gameType: getStoredGameType(),
		poolSizes: parsePoolSizes(
			repo.settings.get<string>(CONVARS_SETTINGS_KEYS.poolSizes),
		),
	};
}

export function setStoredPoolConfig(
	gameType: ConvarGameType,
	poolSizes: PoolSizeOverrides,
): void {
	repo.settings.set(CONVARS_SETTINGS_KEYS.gameType, gameType);
	repo.settings.set(CONVARS_SETTINGS_KEYS.poolSizes, JSON.stringify(poolSizes));
}
