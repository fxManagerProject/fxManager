import { Loading } from '@/components/loading';
import { AuthContext } from '@/hooks/use-auth';
import { QueryService } from '@/lib/query';
import type { AuthUser } from '@/types/auth';
import type {
	ApiResponse,
	ApiError,
	UserPermissionsType,
} from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const navigate = useNavigate();
	const [user, setUser] = useState<AuthUser | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function init() {
			try {
				const me = await QueryService<AuthUser>({
					endpoint: '/auth/me',
					method: 'GET',
				});
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
			const me = await QueryService<AuthUser>({
				endpoint: '/auth/me',
				method: 'GET',
			});
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
    navigate('/login', { replace: true });
	}, []);

	const setup = useCallback(
		async (username: string, password: string) => {
			const response = await QueryService<ApiResponse<AuthUser>>({
				endpoint: '/auth/setup',
				method: 'POST',
				body: { username, password },
			});

			if (!response.success) {
				toast.error('An error occured, please check the console.');
				return;
			}

			setUser(response.data);
			navigate('/dashboard');
		},
		[navigate],
	);

	const hasPermission = useCallback(
		(permission: UserPermissionsType) => {
			if (!user || typeof user.permissions !== 'number') {
				return false;
			}

			return PermissionManager.has(user.permissions, permission);
		},
		[user],
	);

	return (
		<AuthContext.Provider
			value={{ user, loading, login, logout, setup, hasPermission }}
		>
			{loading ? <Loading /> : children}
		</AuthContext.Provider>
	);
}
