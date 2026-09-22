import { useState } from "react";
import { faqData } from "../data";

export function Faq() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section id="faq" style={{ padding: "88px 0" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
        <h2 style={{ textAlign: "center", margin: "0 0 40px", fontSize: "clamp(26px,3vw,34px)" }}>Frequently asked questions</h2>
        {faqData.map((item, i) => {
          const isOpen = openFaq === i;
          return (
            <div key={item.q} style={{ borderBottom: "1px solid var(--color-divider)", padding: "20px 0" }}>
              <button
                type="button"
                onClick={() => setOpenFaq((prev) => (prev === i ? null : i))}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font-heading)",
                  fontSize: 17,
                  color: "var(--color-text)",
                  padding: 0,
                }}
              >
                <span>{item.q}</span>
                {isOpen && <span style={{ flexShrink: 0, color: "var(--color-accent-700)", fontSize: 22, lineHeight: 1 }}>–</span>}
              </button>
              {isOpen && (
                <p
                  style={{
                    margin: "14px 0 0",
                    fontSize: 15,
                    lineHeight: 1.6,
                    maxWidth: "64ch",
                    color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
                  }}
                >
                  {item.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
