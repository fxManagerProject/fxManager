import { Navigate, Route, Routes } from 'react-router-dom';
import { routes } from './pages';
import AppLayout from './components/sidebar';
import { ProtectedRoute } from './components/protected-route';
import NotFound from './pages/NotFound';
import { useAuth } from './hooks/use-auth';

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

			<Route element={<AppLayout />}>
				{layoutRoutes.map(({ path, element, auth }) => (
					<Route
						key={path}
						path={path}
						element={<ProtectedRoute element={element} auth={auth} />}
					/>
				))}
			</Route>

			<Route
				path="*"
				element={<ProtectedRoute element={NotFound} auth={false} />}
			/>
		</Routes>
	);
}
