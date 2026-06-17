import type { SettingsField, SettingsKey, SettingsKeysByScope } from "../types";

export const SETTINGS_SCOPES = {
	general: [],
	fxserver: ['onesync', 'executablePath', 'serverDataPath', 'serverConfigPath'],
	whitelist: ['mode', 'discordGuildId', 'discordWhitelistedRoles'],
} as const;

export const SETTINGS_KEYS = Object.fromEntries(
  Object.entries(SETTINGS_SCOPES).map(([scope, keys]) => [
    scope,
    keys.map((key) => `${scope}.${key}`),
  ])
) as SettingsKeysByScope;

export const SETTINGS_DEFAULTS: Partial<Record<SettingsKey, string | number | boolean>> = {
	'fxserver.onesync': 'on',
	"fxserver.executablePath": './FXServer',
	"fxserver.serverDataPath": './server-data',
	"fxserver.serverConfigPath": 'server.cfg'
} as const;
