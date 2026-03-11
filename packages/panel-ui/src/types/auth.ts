import type { ElementType } from 'react';
import type { Settings } from './settings';

export interface AuthUser {
  id: number;
  username: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  settings: Settings;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setup: (username: string, password: string) => Promise<void>;
}

export interface ProtectedRouteProps {
  auth?: boolean;
  element: ElementType;
}
