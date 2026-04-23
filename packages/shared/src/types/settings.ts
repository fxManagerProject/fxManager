import type { UserPermissionsType } from './security';

export interface BaseAdminUser {
	id: number;
	username: string;
	permissions: UserPermissionsType;
	playerId: number | null;
	createdAt: Date;
	lastLoginAt: Date | null;
}

export interface CreateAdminForm {
	username: string;
	permissions: UserPermissionsType;
	playerId: number | null;
}
