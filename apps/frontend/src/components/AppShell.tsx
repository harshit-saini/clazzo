import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export function AppShell({ brand, navItems, extra }: { brand: string; navItems: NavItem[]; extra?: ReactNode }) {
  const { identity, logout } = useAuth();

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <aside
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
              display: "block",
              padding: "9px 12px",
              borderRadius: "var(--radius-md)",
              fontSize: 14.5,
              color: isActive ? "var(--color-bg)" : "var(--color-text)",
              background: isActive ? "var(--color-accent)" : "transparent",
              textDecoration: "none",
            })}
          >
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
          <button type="button" className="btn btn-ghost" style={{ marginTop: 8, fontSize: 13, padding: 0 }} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: "32px 40px", maxWidth: 1100 }}>
        <Outlet />
      </main>
    </div>
  );
}
