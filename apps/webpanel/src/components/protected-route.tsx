import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import type { ProtectedRouteProps } from '@/types/auth';

export function ProtectedRoute({
	auth = true,
	element: Element,
}: ProtectedRouteProps) {
	const { user } = useAuth();

	if (!user && auth) {
		return <Navigate to="/login" replace />;
	}

	return <Element />;
}
