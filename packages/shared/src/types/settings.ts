import type { SETTINGS_SCOPES } from '../constants';
import type { UserPermissionsType } from './security';

export type AdminGroup = {
	label: string;
	permissions: number;
	colour: string;
	icon?: string;
};

export interface BaseAdminUser {
	id: number;
	username: string;
	permissions: UserPermissionsType;
	group: AdminGroup | null;
	playerId: number | null;
	createdAt: Date;
	lastLoginAt: Date | null;
}

export interface CreateAdminForm {
	username: string;
	permissions: UserPermissionsType;
	playerId: number | null;
}

export type SettingsScope = keyof typeof SETTINGS_SCOPES;

export type SettingsField<T extends SettingsScope> =
	(typeof SETTINGS_SCOPES)[T][number];

export type SettingsKey<T extends SettingsScope = SettingsScope> = {
	[Scope in SettingsScope]: `${Scope}.${SettingsField<Scope>}`;
}[T];

export type SettingsKeysByScope = {
	[Scope in SettingsScope]: SettingsKey<Scope>[];
};

export interface RestartScheduleStatus {
	enabled: boolean;
	times: string[];
	nextRestart: string | null;
	temporary: boolean;
	skipped: boolean;
}
