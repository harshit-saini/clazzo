import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "../lib/api";

export interface StaffIdentity {
  kind: "STAFF";
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "TEACHER";
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
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<Identity>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setIdentity(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<Identity>("/api/auth/me");
      setIdentity(me);
    } catch {
      setToken(null);
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestOtp = useCallback(async (email: string) => {
    await api.post("/api/auth/otp/request", { email });
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    // The verify response's `identity` is the raw JWT payload (userId, no
    // name/email for staff) — fetch /me for the enriched shape the UI needs.
    const { token } = await api.post<{ token: string }>("/api/auth/otp/verify", { email, code });
    setToken(token);
    const me = await api.get<Identity>("/api/auth/me");
    setIdentity(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setIdentity(null);
  }, []);

  return (
    <AuthContext.Provider value={{ identity, loading, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
