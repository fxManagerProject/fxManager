import { LoginForm } from '@/components/login-form';
import { useAuth } from '@/hooks/use-auth';
import { Navigate } from 'react-router-dom';

export default function LoginPage() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
