import { categories } from "../data";

export function Categories() {
  return (
    <section style={{ padding: "72px 0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", margin: "0 0 8px", fontSize: "clamp(26px,3vw,34px)" }}>Popular categories</h2>
        <p style={{ textAlign: "center", margin: "0 0 32px", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
          Browse coaching centers by what you're preparing for.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          {categories.map((cat) => (
            <a key={cat} href="#" className="tag tag-outline" style={{ padding: "10px 20px", fontSize: 14, borderRadius: 999 }}>
              {cat}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
