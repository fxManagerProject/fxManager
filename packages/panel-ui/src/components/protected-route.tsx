import { useAuth } from "@/hooks/use-auth";
import type { ProtectedRouteProps } from "@/types/auth";
import { Navigate } from "react-router-dom";

export function ProtectedRoute({ element: Element }: ProtectedRouteProps) {
  const { user } = useAuth();

  // if (isLoading) return <p>Loading...</p>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Element />;
}