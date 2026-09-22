const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const TOKEN_KEY = "clazzo_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  issues?: unknown;

  constructor(status: number, message: string, issues?: unknown) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json() : undefined;

  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.issues);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
