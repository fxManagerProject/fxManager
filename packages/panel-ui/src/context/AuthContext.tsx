import { AuthContext } from '@/hooks/use-auth';
import { QueryService } from '@/lib/query';
import type { ApiError } from '@/types/api';
import type { AuthUser } from '@/types/auth';
import type { Settings } from '@/types/settings';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [settings, setSettings] = useState<Settings>({
    isSetup: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const status = await QueryService({ endpoint: '/auth/status', method: 'GET' });
        setSettings((prev) => ({ ...prev, isSetup: status.configured }));

        const me = await QueryService({ endpoint: '/auth/me', method: 'GET' });
        setUser(me);
      } catch (err) {
        const status = (err as ApiError).status;
        if (status !== 401) {
          console.error('Unable to check status', status);
          toast.error('An error occured', {
            description: `Make sure you have an active internet connection\nError code: ${status}`,
          });
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      await QueryService({
        endpoint: '/auth/login',
        method: 'POST',
        body: { username, password },
      });
      const me = await QueryService({ endpoint: '/auth/me', method: 'GET' });
      setUser(me);
      navigate('/dashboard');
    },
    [navigate],
  );

  const logout = useCallback(async () => {
    await QueryService({
      endpoint: '/auth/logout',
      method: 'POST',
    });
    setUser(null);
  }, []);

  const setup = useCallback(
    async (username: string, password: string) => {
      if (settings.isSetup) return;

      const response = await QueryService({
        endpoint: '/auth/setup',
        method: 'POST',
        body: { username, password },
      });

      if (!response.success) {
        toast.error('An error occured, please check the console.');
        return;
      }

      setUser({ username: response.username, id: response.id });
      setSettings((prev) => ({ ...prev, isSetup: true }));
      navigate('/dashboard');
    },
    [navigate, settings],
  );

  return (
    <AuthContext.Provider value={{ settings, user, loading, login, logout, setup }}>
      {children}
    </AuthContext.Provider>
  );
}
