import { useState } from "react";
import { faqData } from "../data";

export function Faq() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="section mk-anchor">
      <div className="container" style={{ maxWidth: 800 }}>
        <h2 style={{ textAlign: "center", margin: "0 0 40px", fontSize: "clamp(26px,3vw,34px)" }}>
          Frequently asked questions
        </h2>
        {faqData.map((item, i) => {
          const isOpen = openFaq === i;
          return (
            <div key={item.q} className="mk-faq-item">
              <h3 style={{ margin: 0, fontSize: "inherit" }}>
                <button
                  type="button"
                  className="mk-faq-q"
                  id={`faq-q-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-a-${i}`}
                  onClick={() => setOpenFaq((prev) => (prev === i ? null : i))}
                >
                  <span>{item.q}</span>
                  <span className="mk-faq-marker" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>
              </h3>
              {isOpen && (
                <p className="mk-faq-a" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`}>
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
