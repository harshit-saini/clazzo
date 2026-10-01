import { GraduationCapIcon, SchoolIcon } from "../icons";

const instituteSteps = [
  { title: "Register your institute", body: "Choose a school, college, coaching centre or something else, and start from a structure that suits it." },
  { title: "Set up groups, subjects and students", body: "Add your classes or batches, the subjects taught in each, a weekly timetable, and your students." },
  { title: "Run the term", body: "Mark attendance each class, raise fee invoices, record payments, and see who is overdue." },
];

const studentSteps = [
  { title: "Your institute adds you", body: "They use your email address. You can also sign up first and be added afterwards." },
  { title: "Log in with a code", body: "No password: we email you a one-time code each time you log in." },
  { title: "Guardian confirms (under 18)", body: "A parent or guardian approves access with a separate emailed code, and can withdraw it later." },
];

function StepList({ steps, sage = false }: { steps: { title: string; body: string }[]; sage?: boolean }) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {steps.map((step, i) => (
        <li key={step.title} className="mk-step">
          <div className={`mk-step-num${sage ? " mk-step-num-sage" : ""}`} aria-hidden="true">
            {i + 1}
          </div>
          <div>
            <h4>{step.title}</h4>
            <p>{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="section mk-anchor mk-section-surface on-surface">
      <div className="container">
        <span className="eyebrow mk-eyebrow-block">How it works</span>
        <h2 className="mk-h2" style={{ marginBottom: 48 }}>Simple to set up, for both sides of the classroom</h2>
        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56 }}>
          <div>
            <div className="row" style={{ marginBottom: 28 }}>
              <SchoolIcon size={22} color="var(--color-accent-700)" />
              <h3 style={{ margin: 0, fontSize: 20, color: "var(--color-accent-800)" }}>For institutes</h3>
            </div>
            <StepList steps={instituteSteps} />
          </div>
          <div>
            <div className="row" style={{ marginBottom: 28 }}>
              <GraduationCapIcon size={22} color="var(--color-accent-2-700)" />
              <h3 style={{ margin: 0, fontSize: 20, color: "var(--color-accent-2-800)" }}>For students and guardians</h3>
            </div>
            <StepList steps={studentSteps} sage />
          </div>
        </div>
      </div>
    </section>
  );
}
