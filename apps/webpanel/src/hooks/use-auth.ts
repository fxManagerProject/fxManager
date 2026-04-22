import type { AuthContextValue } from '@/types/auth';
import { createContext, useContext } from 'react';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within AuthProvider');
	return ctx;
}
