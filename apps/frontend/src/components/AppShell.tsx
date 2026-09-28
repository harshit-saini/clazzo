import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { MenuIcon } from "../icons";
import { ErrorBoundary } from "./ErrorBoundary";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon?: ReactNode;
}

export function AppShell({ brand, navItems, extra }: { brand: string; navItems: NavItem[]; extra?: ReactNode }) {
  const { identity, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Close the drawer whenever the route changes, however navigation happened.
  useEffect(() => setOpen(false), [location.pathname]);

  // On mobile the sidebar becomes an off-canvas drawer covering the page —
  // while it's open, trap focus inside it, let Escape close it, and hide
  // the content behind it from screen readers/keyboard tabbing so a user
  // can't tab straight through a hidden dialog into content behind it.
  useEffect(() => {
    if (!open) return;
    const sidebar = sidebarRef.current;
    mainRef.current?.setAttribute("inert", "");
    const focusable = sidebar?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !sidebar) return;
      const items = Array.from(sidebar.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      mainRef.current?.removeAttribute("inert");
      toggleRef.current?.focus();
    };
  }, [open]);

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <button
        ref={toggleRef}
        type="button"
        className="app-shell-toggle"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MenuIcon size={20} />
      </button>
      <div className={`app-shell-scrim${open ? " show" : ""}`} onClick={() => setOpen(false)} />

      <aside
        ref={sidebarRef}
        role="navigation"
        aria-label="Main"
        className={`app-shell-sidebar${open ? " open" : ""}`}
        style={{
          width: 220,
          flexShrink: 0,
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-divider)",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div className="nav-brand" style={{ marginBottom: 24, paddingInline: 8 }}>
          {brand}
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              borderRadius: "var(--radius-md)",
              fontSize: 14.5,
              color: isActive ? "var(--color-bg)" : "var(--color-text)",
              background: isActive ? "var(--color-accent)" : "transparent",
              textDecoration: "none",
            })}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        {extra}
        <div style={{ borderTop: "1px solid var(--color-divider)", paddingTop: 12, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{identity?.name}</div>
          <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
            {identity?.email}
          </div>
          <button type="button" className="btn btn-ghost" style={{ marginTop: 8, marginLeft: -10, fontSize: 13 }} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      {/* minWidth:0 lets this flex child shrink below its content's intrinsic
          width — without it one wide row stretches the column past the viewport
          and the page's own paragraphs get clipped. */}
      <main id="main-content" ref={mainRef} className="app-shell-main" style={{ flex: 1, minWidth: 0, padding: "32px 40px", maxWidth: 1100 }}>
        {/* Keyed by route so a crash on one page doesn't leave every later
            page stuck on the same error screen — a fresh key remounts and
            clears the boundary's caught-error state. */}
        <ErrorBoundary key={location.pathname} compact>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
