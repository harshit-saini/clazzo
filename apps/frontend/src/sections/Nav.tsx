import { useState } from "react";
import { Link } from "react-router-dom";
import { MenuIcon, XIcon } from "../icons";

export function Nav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <nav
      className="nav"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--color-bg)",
        paddingInline: "max(24px, calc((100% - 1200px)/2 + 24px))",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <span className="nav-brand">Clazzo</span>

      <div className={`nav-links${open ? " nav-links-open" : ""}`} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <a href="#features" onClick={close}>Features</a>
        <a href="#centers" onClick={close}>For Coaching Centers</a>
        <a href="#students" onClick={close}>For Students</a>
        <a href="#pricing" onClick={close}>Pricing</a>
        <div className="nav-spacer" style={{ flex: 1 }} />
        <Link to="/login" className="btn btn-ghost" onClick={close}>Log in</Link>
        <Link to="/register" className="btn btn-primary" onClick={close}>Sign up</Link>
      </div>

      <button type="button" className="nav-toggle" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
        {open ? <XIcon size={22} /> : <MenuIcon size={22} />}
      </button>
    </nav>
  );
}
