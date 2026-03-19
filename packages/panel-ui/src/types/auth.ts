import type { ElementType } from 'react';
import type { Settings } from './settings';
import type { UserPermissions } from '@fxmanager/types';

export interface AuthUser {
  id: number;
  username: string;
  permissions: number;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  settings: Settings;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setup: (username: string, password: string) => Promise<void>;
  hasPermission: (permissions: UserPermissions) => boolean;
}

export interface ProtectedRouteProps {
  auth?: boolean;
  element: ElementType;
}
