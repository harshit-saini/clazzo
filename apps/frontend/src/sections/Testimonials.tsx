import { StarFilledIcon, StarOutlineIcon } from "../icons";
import { stats, testimonials } from "../data";

const accentColors = {
  accent: { star: "var(--color-accent-700)", avatarBg: "var(--color-accent-200)", avatarText: "var(--color-accent-800)", tagClass: "tag-accent" },
  "accent-2": { star: "var(--color-accent-2-700)", avatarBg: "var(--color-accent-2-200)", avatarText: "var(--color-accent-2-800)", tagClass: "tag-accent-2" },
};

function Rating({ rating, color }: { rating: number; color: string }) {
  const filled = Math.floor(rating);
  return (
    <div style={{ display: "flex", gap: 2, color }}>
      {Array.from({ length: 5 }, (_, i) =>
        i < filled ? <StarFilledIcon key={i} size={15} /> : <StarOutlineIcon key={i} size={15} strokeWidth={1.5} />
      )}
    </div>
  );
}

export function Testimonials() {
  return (
    <section style={{ padding: "88px 0", background: "var(--color-surface)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", margin: "0 0 48px", fontSize: "clamp(26px,3vw,34px)" }}>
          Trusted by coaching centers and students
        </h2>
        <div style={{ display: "flex", justifyContent: "center", gap: 64, flexWrap: "wrap", marginBottom: 64 }}>
          {stats.map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-heading)", fontSize: 38, margin: 0, color: `var(--color-${stat.accent}-700)` }}>
                {stat.value}
              </p>
              <p
                style={{
                  fontSize: 12.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: "6px 0 0",
                  color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
                }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          {testimonials.map((t) => {
            const c = accentColors[t.accent];
            return (
              <div key={t.name} className="card elev-sm" style={{ padding: 26, gap: 12 }}>
                <Rating rating={t.rating} color={c.star} />
                <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, color: "color-mix(in srgb, var(--color-text) 85%, transparent)" }}>
                  {t.quote}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: c.avatarBg,
                      display: "grid",
                      placeContent: "center",
                      fontFamily: "var(--font-heading)",
                      color: c.avatarText,
                      fontSize: 14,
                    }}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t.name}</p>
                    <p style={{ margin: 0, fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>{t.role}</p>
                  </div>
                  <span className={`tag ${c.tagClass}`} style={{ marginLeft: "auto" }}>
                    {t.tag}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
