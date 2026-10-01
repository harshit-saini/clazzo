import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { AttendanceIcon, CalendarIcon, FeeIcon, HomeIcon, SchoolIcon, ShieldCheckIcon } from "../icons";

const features: { icon: ComponentType<{ size?: number }>; title: string; body: string }[] = [
  { icon: CalendarIcon, title: "Today and this week", body: "See the next seven days of classes across all your institutes, with cancelled classes clearly marked." },
  { icon: AttendanceIcon, title: "Attendance history", body: "Filter by subject or month. Late counts as present, and the page explains each status." },
  { icon: FeeIcon, title: "Fees at a glance", body: "See invoices, what has been paid and what is overdue. Payments are made to your institute directly." },
  { icon: SchoolIcon, title: "More than one institute", body: "One login shows every institute that has added your email, such as school plus a tuition centre." },
  { icon: ShieldCheckIcon, title: "Guardian consent", body: "For students under 18, a parent or guardian approves access with an emailed code and can withdraw it at any time." },
  { icon: HomeIcon, title: "Works like an app", body: "Add Clazzo to your phone's home screen and open it like any other app." },
];

export function StudentFeatures() {
  return (
    <section id="students" className="section mk-anchor mk-section-sage on-surface">
      <div className="container">
        <span className="eyebrow mk-eyebrow-block mk-eyebrow-sage">For students and guardians</span>
        <h2 className="mk-h2">Know where you stand, without asking</h2>
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 22 }}>
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card card-lg elev-sm" style={{ gap: 14 }}>
              <div className="mk-icon-tile mk-icon-tile-sage">
                <Icon size={20} />
              </div>
              <div className="card-title" style={{ fontSize: 17.5 }}>{title}</div>
              <p className="card-body" style={{ fontSize: 14.5 }}>{body}</p>
            </div>
          ))}
        </div>
        <div className="mk-cta-row" style={{ marginTop: 32 }}>
          <Link to="/student/signup" className="btn btn-sage btn-lg">Student sign up</Link>
          <Link to="/login" className="btn btn-secondary btn-lg">Log in</Link>
          <Link to="/consent/confirm" className="btn btn-ghost btn-lg">Guardian? Confirm or withdraw consent</Link>
        </div>
      </div>
    </section>
  );
}
