import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Shared shell for the Privacy, Terms and Contact pages: a header with the
 * brand link, a readable prose column, and a footer that links the three
 * pages to each other and back home. No marketing nav, so these pages stay
 * simple and load fast from the consent email.
 */
export function LegalLayout({ children, draft = false }: { children: ReactNode; draft?: boolean }) {
  return (
    <>
      <header className="legal-header">
        <div className="container">
          <Link to="/" className="nav-brand" style={{ marginRight: 0 }}>
            Clazzo
          </Link>
          <Link to="/" className="btn btn-ghost btn-sm">
            Back to home
          </Link>
        </div>
      </header>
      <main className="legal-main legal-prose">
        {draft && (
          <div className="banner banner-warning" role="note" style={{ marginBottom: 24 }}>
            <strong>Draft — pending legal review</strong>
            <span>
              This page is a working draft and has not been reviewed by a lawyer. It may change, and it is not yet legal advice or a binding
              agreement.
            </span>
          </div>
        )}
        {children}
      </main>
      <footer className="legal-footer">
        <div className="container">
          <span className="text-muted">© {new Date().getFullYear()} Clazzo</span>
          <nav aria-label="Legal" className="row" style={{ gap: 20 }}>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/">Home</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
