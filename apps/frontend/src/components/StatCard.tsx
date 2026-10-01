type Sentiment = "good" | "neutral" | "bad";

/**
 * `accent` alternated by card position with no relation to whether the
 * number is actually good or bad, so the color looked meaningful but
 * wasn't. `sentiment` — when given — overrides it with an explicit,
 * business-logic-driven read (e.g. "0 unmarked sessions" is good, "5" is
 * bad), independent of where the card sits in the grid.
 */
export function StatCard({
  label,
  value,
  accent = "accent",
  sentiment,
}: {
  label: string;
  value: string | number;
  accent?: "accent" | "accent-2";
  sentiment?: Sentiment;
}) {
  const color =
    sentiment === "bad"
      ? "var(--color-danger)"
      : sentiment === "good"
        ? "var(--color-accent-2-700)"
        : sentiment === "neutral"
          ? "var(--color-text)"
          : `var(--color-${accent}-700)`;

  return (
    <div className="card elev-sm" style={{ padding: 20, gap: 6 }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, color }}>{value}</div>
    </div>
  );
}
