import { SchoolIcon, GraduationCapIcon } from "../icons";

const centerSteps = [
  { title: "Register your institute", body: "Create a free profile with your center's details, subjects and locations." },
  { title: "Add courses & batches", body: "List course structures, batch timings and fees so students know exactly what's on offer." },
  { title: "Get students", body: "Appear in search results and start receiving enrollment requests." },
];

const studentSteps = [
  { title: "Search", body: "Look for coaching centers by subject, location or price." },
  { title: "Compare", body: "Check ratings, reviews and course details side by side." },
  { title: "Join", body: "Enroll and pay online, or book a demo class first." },
];

function StepList({ steps, bg, color }: { steps: typeof centerSteps; bg: string; color: string }) {
  return (
    <>
      {steps.map((step, i) => (
        <div key={step.title} style={{ display: "flex", gap: 16, marginBottom: i < steps.length - 1 ? 26 : 0 }}>
          <div
            style={{
              flexShrink: 0,
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: bg,
              color,
              display: "grid",
              placeContent: "center",
              fontFamily: "var(--font-heading)",
              fontSize: 15,
            }}
          >
            {i + 1}
          </div>
          <div>
            <h4 style={{ margin: "0 0 6px", fontSize: 17 }}>{step.title}</h4>
            <p style={{ margin: 0, fontSize: 14.5, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>{step.body}</p>
          </div>
        </div>
      ))}
    </>
  );
}

export function HowItWorks() {
  return (
    <section id="how" style={{ padding: "88px 0", background: "var(--color-surface)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
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
          How it works
        </span>
        <h2 style={{ fontSize: "clamp(28px,3vw,36px)", margin: "0 0 48px", maxWidth: "22ch" }}>
          Built for both sides of the classroom
        </h2>
        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
              <SchoolIcon size={22} color="var(--color-accent-700)" />
              <h3 style={{ margin: 0, fontSize: 20, color: "var(--color-accent-800)" }}>For Coaching Centers</h3>
            </div>
            <StepList steps={centerSteps} bg="var(--color-accent-200)" color="var(--color-accent-800)" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
              <GraduationCapIcon size={22} color="var(--color-accent-2-700)" />
              <h3 style={{ margin: 0, fontSize: 20, color: "var(--color-accent-2-800)" }}>For Students</h3>
            </div>
            <StepList steps={studentSteps} bg="var(--color-accent-2-200)" color="var(--color-accent-2-800)" />
          </div>
        </div>
      </div>
    </section>
  );
}
