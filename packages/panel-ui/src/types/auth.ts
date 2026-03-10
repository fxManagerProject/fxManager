import type { ElementType } from 'react';

export interface AuthUser {
  id: number;
  username: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export interface ProtectedRouteProps {
  auth?: boolean;
  element: ElementType;
}
