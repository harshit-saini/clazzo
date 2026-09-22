export function Nav() {
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
      <a href="#features">Features</a>
      <a href="#centers">For Coaching Centers</a>
      <a href="#students">For Students</a>
      <a href="#pricing">Pricing</a>
      <div style={{ flex: 1 }} />
      <a href="#" className="btn btn-ghost">Log in</a>
      <a href="#" className="btn btn-primary">Sign up</a>
    </nav>
  );
}
