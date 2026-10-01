import { Link } from "react-router-dom";
import { CheckIcon } from "../icons";
import { pricingPlans } from "../data";

export function Pricing() {
  return (
    <section id="pricing" className="section mk-anchor mk-section-surface on-surface">
      <div className="container">
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 48px" }}>
          <span className="eyebrow mk-eyebrow-block">Pricing</span>
          <h2 style={{ fontSize: "clamp(26px,3vw,34px)", margin: 0 }}>Free during early access</h2>
          <p style={{ margin: "14px 0 0", color: "var(--color-text-muted)" }}>
            Clazzo is new. Every feature is free for institutes and for students while we learn from real use.
            Paid plans may come later; we will tell you well in advance and you will never be charged without agreeing.
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {pricingPlans.map((plan) => (
            <div key={plan.id} className="card elev-md mk-plan mk-plan-featured" style={{ width: "min(460px, 100%)" }}>
              <span className="tag tag-accent" style={{ alignSelf: "flex-start" }}>
                Early access
              </span>
              <div className="card-kicker">{plan.name}</div>
              <div>
                <span className="mk-plan-price">{plan.price}</span>{" "}
                <span className="text-muted" style={{ fontSize: 14 }}>{plan.priceNote}</span>
              </div>
              <p className="card-body" style={{ fontSize: 14.5, flex: "none" }}>{plan.description}</p>
              <ul style={{ display: "grid", gap: 10, listStyle: "none", margin: 0, padding: 0 }}>
                {plan.features.map((feature) => (
                  <li key={feature} className="row" style={{ flexWrap: "nowrap", gap: 8, fontSize: 14, alignItems: "flex-start" }}>
                    <span style={{ marginTop: 3, flexShrink: 0 }}>
                      <CheckIcon size={15} color="var(--color-accent-700)" strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="btn btn-primary btn-block">
                Register your institute
              </Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", margin: "28px 0 0", fontSize: 13, color: "var(--color-text-muted)" }}>
          Early-access terms may change. Clazzo does not process fee payments; institutes record the payments they
          receive.
        </p>
      </div>
    </section>
  );
}
