import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, api, getToken, setToken, setUnauthorizedHandler } from "../lib/api";

export interface StaffIdentity {
  kind: "STAFF";
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "TEACHER" | "ACCOUNTANT";
  instituteId: string;
}

export interface StudentIdentity {
  kind: "STUDENT";
  id: string;
  name: string;
  email: string;
}

export type Identity = StaffIdentity | StudentIdentity;

interface AuthContextValue {
  identity: Identity | null;
  loading: boolean;
  /** The server couldn't be reached while restoring the session — the token is kept, not discarded. */
  connectionError: boolean;
  /** The session ended because the server rejected the token (not because the user logged out). */
  sessionExpired: boolean;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<Identity>;
  /** Re-reads the current user (e.g. after a name change in Settings). */
  refresh: () => Promise<void>;
  retry: () => void;
  logout: () => void;
}

const IDENTITY_CACHE_KEY = "clazzo_identity";

function readCachedIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

function cacheIdentity(identity: Identity | null) {
  if (identity) localStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(identity));
  else localStorage.removeItem(IDENTITY_CACHE_KEY);
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Lets the 401 handler know whether anyone was actually signed in — a
  // wrong code typed on the login page is also a 401, but isn't an "expiry".
  const identityRef = useRef<Identity | null>(null);
  identityRef.current = identity;

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setIdentity(null);
      setConnectionError(false);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<Identity>("/api/auth/me");
      cacheIdentity(me);
      setIdentity(me);
      setConnectionError(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // api.ts already cleared the token and notified us below.
        cacheIdentity(null);
        setIdentity(null);
        setConnectionError(false);
      } else {
        // No signal, a timeout, or the server having a bad moment says
        // nothing about whether this session is valid. Opening the installed
        // app offline used to throw the token away and drop teachers on the
        // marketing page; instead keep it and fall back to the last known
        // identity so the app still opens.
        const cached = readCachedIdentity();
        if (cached) setIdentity(cached);
        setConnectionError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Came back online while running on a cached identity — re-validate.
  useEffect(() => {
    if (!connectionError) return;
    const onOnline = () => refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [connectionError, refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (identityRef.current) setSessionExpired(true);
      cacheIdentity(null);
      setIdentity(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const requestOtp = useCallback(async (email: string) => {
    await api.post("/api/auth/otp/request", { email });
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    // The verify response's `identity` is the raw JWT payload (userId, no
    // name/email for staff) — fetch /me for the enriched shape the UI needs.
    const { token } = await api.post<{ token: string }>("/api/auth/otp/verify", { email, code });
    setToken(token);
    const me = await api.get<Identity>("/api/auth/me");
    cacheIdentity(me);
    setIdentity(me);
    setSessionExpired(false);
    setConnectionError(false);
    return me;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    cacheIdentity(null);
    setSessionExpired(false);
    setConnectionError(false);
    setIdentity(null);
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{ identity, loading, connectionError, sessionExpired, requestOtp, verifyOtp, refresh, retry, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
