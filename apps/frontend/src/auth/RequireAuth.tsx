import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

/** Renders its route's children only for the given identity kind; otherwise redirects to login. */
export function RequireAuth({ kind }: { kind: "STAFF" | "STUDENT" }) {
  const { identity, loading } = useAuth();

  if (loading) return null;
  if (!identity) return <Navigate to="/login" replace />;
  if (identity.kind !== kind) return <Navigate to="/" replace />;

  return <Outlet />;
}
