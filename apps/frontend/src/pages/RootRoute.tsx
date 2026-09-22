import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Home } from "./Home";

/**
 * "/" is both the marketing homepage and the PWA's start_url. A logged-in
 * user (especially one opening the installed app) wants their dashboard or
 * portal, not the marketing pitch, so redirect if a session already exists.
 */
export function RootRoute() {
  const { identity, loading } = useAuth();

  if (loading) return null;
  if (identity?.kind === "STAFF") return <Navigate to="/dashboard" replace />;
  if (identity?.kind === "STUDENT") return <Navigate to="/portal" replace />;

  return <Home />;
}
