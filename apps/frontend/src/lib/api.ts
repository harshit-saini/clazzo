const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const TOKEN_KEY = "clazzo_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// AuthContext registers itself here on mount so a 401 from any request —
// including one that fires mid-session (expired token, deactivated
// account) — can clear its in-memory identity immediately. Without this,
// api.ts clearing localStorage did nothing to the identity already held in
// React state, so RequireAuth never noticed and the page just stayed put
// showing stale data instead of redirecting to /login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
  issues?: unknown;
  /** Extra machine-readable detail the API attaches (e.g. `reason`, `attemptsLeft`, `code`). */
  data?: Record<string, unknown>;

  constructor(status: number, message: string, issues?: unknown, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.issues = issues;
    this.data = data;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // fetch only rejects when the request never completed (no signal, DNS,
    // server down). Surface that as an ApiError with status 0 so callers can
    // tell "couldn't reach the server" apart from "the server said no".
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json() : undefined;

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      onUnauthorized?.();
    }
    // "Validation failed" is the server's wording, not a sentence for a person.
    const friendly = data?.error === "Validation failed" ? "Please check what you entered." : data?.error;
    throw new ApiError(res.status, friendly ?? `Request failed (${res.status})`, data?.issues, data);
  }

  return data as T;
}

/** Flattens the backend's Zod `issues` array into a `{ field: message }` map
 * so a form can point a validation error at the specific input, instead of
 * only ever showing one generic banner below the whole form. */
export function fieldErrors(issues: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(issues)) return out;
  for (const issue of issues) {
    if (issue && typeof issue === "object" && "path" in issue && "message" in issue) {
      const path = (issue as { path: unknown }).path;
      const key = Array.isArray(path) ? path.join(".") : String(path);
      if (key) out[key] = String((issue as { message: unknown }).message);
    }
  }
  return out;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
