import type { ComponentType } from "react";
import { AttendanceIcon, BarChartIcon, CalendarIcon, FeeIcon, SearchIcon, UsersIcon } from "../icons";

const centerIconTileStyle = { background: "var(--color-accent-200)", border: "none", color: "var(--color-accent-800)" };

const features: { icon: ComponentType<{ size?: number }>; title: string; body: string }[] = [
  { icon: UsersIcon, title: "Student management", body: "Track enrollments, attendance and progress for every batch in one place." },
  { icon: CalendarIcon, title: "Batch & course scheduling", body: "Set up batch timings, course structures and demo classes without spreadsheets." },
  { icon: FeeIcon, title: "Fee & payment tracking", body: "Record fee payments, send reminders and see who's due, automatically." },
  { icon: AttendanceIcon, title: "Attendance", body: "Mark attendance in seconds and share reports with parents." },
  { icon: SearchIcon, title: "Online visibility", body: "Get listed where students are already searching for coaching centers near them." },
  { icon: BarChartIcon, title: "Analytics dashboard", body: "See enrollment trends, revenue and batch performance at a glance." },
];

export function CenterFeatures() {
  return (
    <section id="centers" style={{ padding: "88px 0" }}>
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
          For Coaching Centers
        </span>
        <h2 style={{ fontSize: "clamp(26px,3vw,34px)", margin: "0 0 40px", maxWidth: "26ch" }}>
          Run your institute without the busywork
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 22 }}>
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card elev-sm" style={{ padding: 26, gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeContent: "center", ...centerIconTileStyle }}>
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
