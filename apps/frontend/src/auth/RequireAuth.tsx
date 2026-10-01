import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

/** Renders its route's children only for the given identity kind; otherwise redirects to login. */
export function RequireAuth({ kind }: { kind: "STAFF" | "STUDENT" }) {
  const { identity, loading, connectionError, sessionExpired, retry } = useAuth();
  const location = useLocation();

  if (loading) return null;

  // Couldn't reach the server and there's nothing cached to show: say so,
  // rather than bouncing a possibly-valid session to the login page.
  if (!identity && connectionError) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card card-lg elev-md" style={{ width: "min(400px, 100%)", textAlign: "center", alignItems: "center" }}>
          <h1 className="auth-title">Can't reach Clazzo</h1>
          <p className="text-muted" style={{ margin: 0 }}>
            You're signed in, but we couldn't connect. Check your connection and try again.
          </p>
          <button type="button" className="btn btn-primary" onClick={retry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!identity) {
    // Remember where they were headed, and why they're here, so the login
    // page can explain and send them back afterwards.
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}`, reason: sessionExpired ? "expired" : undefined }}
      />
    );
  }
  if (identity.kind !== kind) return <Navigate to="/" replace />;

  return <Outlet />;
}
