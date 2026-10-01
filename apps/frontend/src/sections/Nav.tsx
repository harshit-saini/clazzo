import { useState } from "react";
import { Link } from "react-router-dom";
import { MenuIcon, XIcon } from "../icons";

export function Nav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <nav className="nav mk-nav" aria-label="Main">
      <Link to="/" className="nav-brand" onClick={close}>
        Clazzo
      </Link>

      <div id="primary-nav" className={`nav-links mk-nav-links${open ? " nav-links-open" : ""}`}>
        <a href="#how" onClick={close}>How it works</a>
        <a href="#institutes" onClick={close}>For institutes</a>
        <a href="#students" onClick={close}>For students</a>
        <a href="#pricing" onClick={close}>Pricing</a>
        <div className="nav-spacer" />
        <Link to="/login" className="btn btn-ghost" onClick={close}>Log in</Link>
        <Link to="/register" className="btn btn-primary" onClick={close}>Register institute</Link>
      </div>

      <button
        type="button"
        className="nav-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="primary-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <XIcon size={22} /> : <MenuIcon size={22} />}
      </button>
    </nav>
  );
}
