import { Link } from "react-router-dom";
import { footerColumns, SUPPORT_EMAIL } from "../data";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mk-footer">
      <div className="container mk-footer-grid">
        <div>
          <Link to="/" className="nav-brand">
            Clazzo
          </Link>
          <p style={{ margin: "14px 0 0", fontSize: 14, maxWidth: "34ch", color: "var(--color-text-muted)" }}>
            Attendance, fees and a student portal for schools, colleges, coaching centres and tutors.
          </p>
          <p style={{ margin: "14px 0 0", fontSize: 14 }}>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </div>
        {footerColumns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h4 className="mk-footer-title">{col.title}</h4>
            <div className="mk-footer-links">
              {col.links.map((link) =>
                link.to ? (
                  <Link key={link.label} to={link.to} className="mk-footer-link">
                    {link.label}
                  </Link>
                ) : (
                  <a key={link.label} href={link.href} className="mk-footer-link">
                    {link.label}
                  </a>
                )
              )}
            </div>
          </nav>
        ))}
      </div>
      <div className="container">
        <div className="mk-footer-bottom">
          <p>© {year} Clazzo. All rights reserved.</p>
          <div className="mk-footer-legal">
            <Link to="/terms" className="mk-footer-link">Terms</Link>
            <Link to="/privacy" className="mk-footer-link">Privacy</Link>
            <Link to="/contact" className="mk-footer-link">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
