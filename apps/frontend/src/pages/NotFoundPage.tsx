import { Link } from "react-router-dom";

/** Any unmatched route (a typo, a stale bookmark, a deleted record's old
 * link) used to render nothing at all — no nav, no message, just a blank
 * page with no way back except editing the URL. */
export function NotFoundPage() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-md" style={{ width: "min(420px, 100%)", padding: 36, gap: 14, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Page not found</h1>
        <p style={{ fontSize: 14, margin: 0, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
          This link may be old, or the page may have moved.
        </p>
        <Link to="/" className="btn btn-primary btn-block">
          Go home
        </Link>
      </div>
    </div>
  );
}
