import { FacebookIcon, InstagramIcon, LinkedinIcon, XIcon } from "../icons";
import { footerColumns } from "../data";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ padding: "0 0 40px" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "1.3fr repeat(3,1fr)",
          gap: 32,
          marginBottom: 40,
        }}
      >
        <div>
          <span className="nav-brand">Clazzo</span>
          <p style={{ margin: "14px 0 0", fontSize: 14, maxWidth: "32ch", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
            Connecting coaching centers and students, from search to enrollment.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <a href="#" aria-label="X" className="btn btn-ghost btn-icon">
              <XIcon size={16} />
            </a>
            <a href="#" aria-label="Instagram" className="btn btn-ghost btn-icon">
              <InstagramIcon size={16} />
            </a>
            <a href="#" aria-label="LinkedIn" className="btn btn-ghost btn-icon">
              <LinkedinIcon size={16} />
            </a>
            <a href="#" aria-label="Facebook" className="btn btn-ghost btn-icon">
              <FacebookIcon size={16} />
            </a>
          </div>
        </div>
        {footerColumns.map((col) => (
          <div key={col.title}>
            <h4
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: "0 0 16px",
                color: "color-mix(in srgb, var(--color-text) 65%, transparent)",
              }}
            >
              {col.title}
            </h4>
            <div style={{ display: "grid", gap: 10 }}>
              {col.links.map((link) => (
                <a key={link.label} href={link.href} style={{ fontSize: 14, color: "var(--color-text)" }}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 24px 0",
          borderTop: "1px solid var(--color-divider)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
          © {year} Clazzo. All rights reserved.
        </p>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="#" style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>Terms</a>
          <a href="#" style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>Privacy</a>
        </div>
      </div>
    </footer>
  );
}
