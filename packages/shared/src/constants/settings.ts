import type { SettingsKey, SettingsKeysByScope } from '../types';

export const SETTINGS_SCOPES = {
	general: [],
	fxserver: ['onesync', 'executablePath', 'serverDataPath', 'serverConfigPath'],
	whitelist: ['mode', 'discordBotToken', 'discordGuildId', 'discordRoleIds'],
	restarts: ['enabled', 'times'],
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
	'restarts.enabled': 'false',
	'restarts.times': '',
} satisfies Partial<Record<SettingsKey, string>>;

export const SETTINGS_SENSITIVE_KEYS: SettingsKey[] = [
	'whitelist.discordBotToken',
];

export const SETTINGS_MASTER_ONLY_KEYS: SettingsKey[] = [
	'fxserver.executablePath',
	'fxserver.serverDataPath',
	'fxserver.serverConfigPath',
];
