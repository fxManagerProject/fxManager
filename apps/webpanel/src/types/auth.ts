import type { ElementType } from 'react';
import type { UserPermissionsType } from '@fxmanager/shared/types';

export interface AuthUser {
	id: number;
	username: string;
	permissions: number;
}

export interface AuthContextValue {
	user: AuthUser | null;
	loading: boolean;
	login: (username: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	setup: (username: string, password: string) => Promise<void>;
	hasPermission: (permissions: UserPermissionsType) => boolean;
}

export interface ProtectedRouteProps {
	auth?: boolean;
	element: ElementType;
}
