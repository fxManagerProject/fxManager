import { PermissionManager } from '@fxmanager/shared/utils';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/protected-route';
import AppLayout from './components/sidebar';
import { useAuth } from './hooks/use-auth';
import { routes } from './pages';
import NotFound from './pages/NotFound';

export function App() {
	const { user } = useAuth();

	const layoutRoutes = routes.filter(
		(r) => r.layout !== false && r.auth !== false,
	);
	const standaloneRoutes = routes.filter(
		(r) => r.layout === false || r.auth === false,
	);

	return (
		<Routes>
			<Route
				path="/"
				element={<Navigate to={user ? '/dashboard' : '/login'} replace />}
			/>

			{standaloneRoutes.map(({ path, element, auth }) => (
				<Route
					key={path}
					path={path}
					element={<ProtectedRoute element={element} auth={auth} />}
				/>
			))}

			{user && (
				<Route element={<AppLayout />}>
					{layoutRoutes.map(({ path, element, auth, permission }) => {
						if (
							permission &&
							!PermissionManager.has(user.permissions, permission)
						)
							return null;

						return (
							<Route
								key={path}
								path={path}
								element={<ProtectedRoute element={element} auth={auth} />}
							/>
						);
					})}
					<Route
						path="*"
						element={<ProtectedRoute element={NotFound} auth={false} />}
					/>
				</Route>
			)}

			<Route
				path="*"
				element={<ProtectedRoute element={NotFound} auth={false} />}
			/>
		</Routes>
	);
}
