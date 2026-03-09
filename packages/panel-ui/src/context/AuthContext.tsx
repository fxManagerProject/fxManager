import { AuthContext } from '@/hooks/use-auth';
import { QueryService } from '@/lib/query';
import type { AuthUser } from '@/types/auth';
import { useState, useEffect, useCallback } from 'react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const status = await fetch('/auth/status').then((r) => r.json());
        setConfigured(status.configured);
        if (status.configured) {
          const me = await fetch('/auth/me');
          if (me.ok) setUser(await me.json());
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await QueryService({
      endpoint: '/auth/login',
      method: 'POST',
      body: { username, password },
    })
    const me = await QueryService({ endpoint: '/auth/me', method: 'GET' })
    setUser(me)
  }, []);

  const setup = useCallback(async (username: string, password: string) => {
    const res = await QueryService({
      endpoint: '/auth/setup',
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Setup failed');
    setConfigured(true);
    const me = await QueryService({
      endpoint: '/auth/me',
      method: 'GET',
    });
    if (me.ok) setUser(await me.json());
  }, []);

  const logout = useCallback(async () => {
    await QueryService({
      endpoint: '/auth/logout',
      method: 'POST',
    });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, configured, loading, login, setup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
