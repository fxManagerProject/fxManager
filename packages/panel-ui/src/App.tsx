import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/sidebar';
import { ProtectedRoute } from './components/protected-route';
import { useAuth } from './hooks/use-auth';

import { LoadingScreen } from './components/loading';
import SetupPage from './pages/public/Setup';
import NotFound from './pages/public/NotFound';
import { routes } from './pages';

export function App() {
  const { user, loading, settings } = useAuth();

  if (loading) return <LoadingScreen message="Loading session" />;
  if (!settings.isSetup) return <SetupPage />;

  const layoutRoutes = routes.filter((r) => r.layout !== false && r.auth !== false);
  const standaloneRoutes = routes.filter((r) => r.layout === false || r.auth === false);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />

      {standaloneRoutes.map(({ path, element, auth }) => (
        <Route key={path} path={path} element={<ProtectedRoute element={element} auth={auth} />} />
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

      <Route path="*" element={<ProtectedRoute element={NotFound} auth={false} />} />
    </Routes>
  );
}

export default App;
