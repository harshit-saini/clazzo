import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { MenuIcon, SearchIcon, SettingsIcon, XIcon } from "../icons";
import { ErrorBoundary } from "./ErrorBoundary";
import { InstallPrompt } from "./InstallPrompt";
import { GlobalSearch } from "./GlobalSearch";
import { useMediaQuery, useOnline } from "../lib/useOnline";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const THEME_KEY = "clazzo_theme";

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon?: ReactNode;
}

type Theme = "light" | "dark";

export function AppShell({
  brand,
  navItems,
  settingsTo,
  extra,
}: {
  brand: string;
  navItems: NavItem[];
  settingsTo: string;
  extra?: ReactNode;
}) {
  const { identity, logout, connectionError } = useAuth();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"));
  const location = useLocation();
  const online = useOnline();
  const isMobile = useMediaQuery("(max-width: 860px)");
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // The dark theme is scoped to the signed-in app: the marketing site and
  // auth pages keep their light look, so the attribute only exists while
  // this shell is mounted.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  // Ctrl/⌘+K opens search anywhere in the staff app.
  const isStaff = identity?.kind === "STAFF";
  useEffect(() => {
    if (!isStaff) return;
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isStaff]);

  // Close the drawer whenever the route changes, however navigation happened.
  useEffect(() => setOpen(false), [location.pathname]);

  // After a client-side navigation focus would otherwise stay on the link
  // that was clicked, so a screen reader announces nothing. Move it to the
  // new page's heading (or the content area as a fallback).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const target = mainRef.current?.querySelector<HTMLElement>("h1") ?? mainRef.current;
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }, [location.pathname]);

  // On mobile a closed drawer is only slid off-screen, so keep it out of the
  // tab order and the accessibility tree until it's open.
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    if (isMobile && !open) sidebar.setAttribute("inert", "");
    else sidebar.removeAttribute("inert");
  }, [isMobile, open]);

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

  const homeTo = navItems[0]?.to ?? "/";

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <button
        ref={toggleRef}
        type="button"
        className="app-shell-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="app-sidebar"
        onClick={() => setOpen((v) => !v)}
      >
        <MenuIcon size={20} />
      </button>
      <div className={`app-shell-scrim${open ? " show" : ""}`} onClick={() => setOpen(false)} />

      <aside
        id="app-sidebar"
        ref={sidebarRef}
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
        <button type="button" className="app-shell-close" aria-label="Close menu" onClick={() => setOpen(false)}>
          <XIcon size={18} />
        </button>
        <Link to={homeTo} className="nav-brand" style={{ marginBottom: 24, paddingInline: 8, marginRight: 0 }}>
          {brand}
        </Link>
        {isStaff && (
          <button type="button" className="btn btn-secondary btn-sm search-trigger" onClick={() => setSearching(true)}>
            <span className="row" style={{ gap: 6 }}>
              <SearchIcon size={15} /> Search
            </span>
            <kbd aria-hidden="true">Ctrl K</kbd>
          </button>
        )}
        <nav aria-label="Primary" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="side-nav-link">
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        {extra}
        <div style={{ borderTop: "1px solid var(--color-divider)", paddingTop: 12, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{identity?.name}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", overflowWrap: "anywhere" }}>{identity?.email}</div>
          <NavLink to={settingsTo} className="side-nav-link" style={{ marginTop: 8, fontSize: 13.5 }}>
            <SettingsIcon size={16} />
            Settings
          </NavLink>
          <button
            type="button"
            className="btn btn-ghost theme-toggle"
            aria-pressed={theme === "dark"}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          </button>
          <button type="button" className="btn btn-ghost theme-toggle" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main id="main-content" ref={mainRef} className="app-shell-main">
        {(!online || connectionError) && (
          <div className="offline-banner" role="status">
            You're offline — showing what was saved on this device. Changes will work again once you reconnect.
          </div>
        )}
        {/* Keyed by route so a crash on one page doesn't leave every later
            page stuck on the same error screen — a fresh key remounts and
            clears the boundary's caught-error state. */}
        <ErrorBoundary key={location.pathname} compact>
          <Outlet />
        </ErrorBoundary>
      </main>
      <InstallPrompt />
      {searching && identity?.kind === "STAFF" && (
        <GlobalSearch onClose={() => setSearching(false)} canBrowseStructure={identity.role !== "ACCOUNTANT"} />
      )}
    </div>
  );
}
