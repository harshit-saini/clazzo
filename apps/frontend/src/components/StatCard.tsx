export function StatCard({ label, value, accent = "accent" }: { label: string; value: string | number; accent?: "accent" | "accent-2" }) {
  return (
    <div className="card elev-sm" style={{ padding: 20, gap: 6 }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, color: `var(--color-${accent}-700)` }}>{value}</div>
    </div>
  );
}
