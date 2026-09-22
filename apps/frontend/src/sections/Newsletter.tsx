export function Newsletter() {
  return (
    <section style={{ padding: "0 0 64px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            background: "var(--color-accent-2-100)",
            borderRadius: 48,
            padding: "52px 48px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 25 }}>Stay in the loop</h3>
            <p style={{ margin: 0, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
              New coaching centers, feature updates and student tips — a couple of emails a month, never more.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 280, maxWidth: 420 }}>
            <input className="input" type="email" placeholder="you@example.com" aria-label="Email address" style={{ flex: 1 }} />
            <button type="button" className="btn btn-primary">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
