import type { ReactNode } from "react";

/**
 * Consistent loading/error/content rendering for a `useApiData` result —
 * every list/detail page in the app used to just do `if (!data) return null`
 * with no `.catch`, so any fetch failure left the page blank forever with
 * no way to tell what happened or retry.
 */
export function AsyncState<T>({
  loading,
  error,
  data,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  data: T | null;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}) {
  if (error) {
    return (
      <div className="card" style={{ padding: 20, gap: 10, alignItems: "flex-start" }}>
        <p style={{ margin: 0, color: "var(--color-accent-700)", fontSize: 14 }}>{error}</p>
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (loading && data === null) {
    return <p style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>Loading…</p>;
  }

  if (data === null) return null;

  return <>{children(data)}</>;
}
