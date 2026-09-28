import type { ReactNode } from "react";
import { Link } from "react-router-dom";

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
  backTo,
  backLabel = "Back",
  children,
}: {
  loading: boolean;
  error: string | null;
  data: T | null;
  onRetry: () => void;
  /** When the whole page failed to load, "Try again" alone is a dead end on
   * a detail page — this gives a way back to the parent list too. */
  backTo?: string;
  backLabel?: string;
  children: (data: T) => ReactNode;
}) {
  if (error) {
    return (
      <div className="card" style={{ padding: 20, gap: 10, alignItems: "flex-start" }}>
        <p style={{ margin: 0, color: "var(--color-danger)", fontSize: 14 }}>{error}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Try again
          </button>
          {backTo && (
            <Link to={backTo} className="btn btn-ghost">
              {backLabel}
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (loading && data === null) {
    return <p style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>Loading…</p>;
  }

  if (data === null) return null;

  return <>{children(data)}</>;
}
