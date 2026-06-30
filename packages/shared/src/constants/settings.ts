import type { SettingsKey, SettingsKeysByScope } from '../types';

export const SETTINGS_SCOPES = {
	general: [],
	fxserver: ['onesync', 'executablePath', 'serverDataPath', 'serverConfigPath'],
	whitelist: ['mode', 'discordBotToken', 'discordGuildId', 'discordRoleIds'],
} as const;

export const SETTINGS_KEYS = Object.fromEntries(
	Object.entries(SETTINGS_SCOPES).map(([scope, keys]) => [
		scope,
		keys.map((key) => `${scope}.${key}`),
	]),
) as SettingsKeysByScope;

export const SETTINGS_DEFAULTS = {
	'fxserver.onesync': 'on',
	'fxserver.executablePath': './FXServer',
	'fxserver.serverDataPath': './server-data',
	'fxserver.serverConfigPath': 'server.cfg',
	'whitelist.mode': 'none',
} satisfies Partial<Record<SettingsKey, string>>;
