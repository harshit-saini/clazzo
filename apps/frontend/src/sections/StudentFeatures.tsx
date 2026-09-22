import type { ComponentType } from "react";
import { CheckCircleIcon, FeeIcon, FilterIcon, ShieldCheckIcon, StarOutlineIcon, VideoIcon } from "../icons";

const studentIconTileStyle = { background: "var(--color-accent-2-200)", border: "none", color: "var(--color-accent-2-800)" };

const features: { icon: ComponentType<{ size?: number }>; title: string; body: string }[] = [
  { icon: FilterIcon, title: "Search & filter", body: "Narrow down coaching centers by subject, location and price." },
  { icon: StarOutlineIcon, title: "Reviews & ratings", body: "Read what other students say before you commit." },
  { icon: CheckCircleIcon, title: "Easy enrollment", body: "Join a batch online in a few taps, no paperwork." },
  { icon: VideoIcon, title: "Demo classes", body: "Try a class before you enroll." },
  { icon: FeeIcon, title: "Online payment", body: "Pay fees securely without visiting in person." },
  { icon: ShieldCheckIcon, title: "Verified centers", body: "Every listed center passes a basic verification check." },
];

export function StudentFeatures() {
  return (
    <section id="students" style={{ padding: "88px 0", background: "var(--color-accent-2-100)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <span
          style={{
            display: "block",
            fontSize: 13,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--color-accent-2-700)",
            marginBottom: 12,
          }}
        >
          For Students
        </span>
        <h2 style={{ fontSize: "clamp(26px,3vw,34px)", margin: "0 0 40px", maxWidth: "26ch" }}>
          Find the right coaching center, faster
        </h2>
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 22 }}>
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card elev-sm" style={{ padding: 26, gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeContent: "center", ...studentIconTileStyle }}>
                <Icon size={20} />
              </div>
              <div className="card-title" style={{ fontSize: 17.5 }}>{title}</div>
              <p className="card-body" style={{ fontSize: 14.5 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
