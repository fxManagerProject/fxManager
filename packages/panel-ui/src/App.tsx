import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/sidebar';
import { ProtectedRoute } from './components/protected-route';
import { useAuth } from './hooks/use-auth';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Players from './pages/Players';
import Console from './pages/Console';
import { LoadingScreen } from './components/loading';
import SetupPage from './pages/Setup';
import PlayerView from './pages/Player';

export function App() {
  const { user, loading, settings } = useAuth();

  if (loading) return <LoadingScreen message="Loading session" />;

  if (!settings.isSetup) {
    return <SetupPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="/login" element={<ProtectedRoute element={LoginPage} auth={false} />} />

      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<ProtectedRoute element={Dashboard} />} />
        <Route path="/players" element={<ProtectedRoute element={Players} />} />
        <Route path="/players/:playerId" element={<ProtectedRoute element={PlayerView} />} />
        <Route path="/console" element={<ProtectedRoute element={Console} />} />
        <Route path="/settings" element={<ProtectedRoute element={Settings} />} />
      </Route>

      <Route path="*" element={<p>Not Found</p>} />
    </Routes>
  );
}

export default App;
