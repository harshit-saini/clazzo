import { CheckIcon } from "../icons";
import { pricingPlans } from "../data";

export function Pricing() {
  return (
    <section id="pricing" style={{ padding: "88px 0", background: "var(--color-surface)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 48px" }}>
          <span
            style={{
              display: "block",
              fontSize: 13,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--color-accent-700)",
              marginBottom: 12,
            }}
          >
            Pricing
          </span>
          <h2 style={{ fontSize: "clamp(26px,3vw,34px)", margin: 0 }}>Simple pricing for coaching centers</h2>
          <p style={{ margin: "14px 0 0", color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
            Students always join for free. Coaching centers pick a plan that fits their size.
          </p>
        </div>
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 22, alignItems: "start" }}>
          {pricingPlans.map((plan) => (
            <div
              key={plan.id}
              className="card elev-md"
              style={{
                padding: 32,
                gap: 18,
                border: plan.highlighted ? "2px solid var(--color-accent)" : "2px solid transparent",
              }}
            >
              {plan.highlighted && (
                <span className="tag tag-accent" style={{ alignSelf: "flex-start" }}>
                  Most popular
                </span>
              )}
              <div className="card-kicker">{plan.name}</div>
              <div>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 32 }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>/mo</span>
              </div>
              <p className="card-body" style={{ fontSize: 14.5 }}>{plan.description}</p>
              <div style={{ display: "grid", gap: 10 }}>
                {plan.features.map((feature) => (
                  <div key={feature} style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center" }}>
                    <CheckIcon size={15} color="var(--color-accent-700)" strokeWidth={3} />
                    {feature}
                  </div>
                ))}
              </div>
              <a href="#" className={`btn ${plan.ctaVariant} btn-block`}>
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", margin: "28px 0 0", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          Prices shown are indicative starting rates.
        </p>
      </div>
    </section>
  );
}
