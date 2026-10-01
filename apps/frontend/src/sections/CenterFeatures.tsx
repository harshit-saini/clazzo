import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { AttendanceIcon, BookIcon, CalendarIcon, FeeIcon, SchoolIcon, UsersIcon } from "../icons";

const features: { icon: ComponentType<{ size?: number }>; title: string; body: string }[] = [
  {
    icon: SchoolIcon,
    title: "A structure that fits you",
    body: "Schools use classes and sections, colleges use centres, degrees and batches, coaching centres use centres and batches, and tutors just keep a list of groups. Rename or reshape any level later.",
  },
  { icon: UsersIcon, title: "Students and staff", body: "Keep student records with guardian contact details. Invite owners, teachers and accountants, each seeing only what their role needs." },
  { icon: BookIcon, title: "Subjects and teachers", body: "Attach subjects to a class or batch, assign a teacher, and make a subject optional so only the students who chose it are included." },
  { icon: CalendarIcon, title: "Timetable and sessions", body: "Set a weekly timetable, generate class sessions, and cancel a session when a class is called off. Students see the change." },
  { icon: AttendanceIcon, title: "Attendance on a phone", body: "Mark present, absent, late or excused for a whole roster in a few taps, and review a student's attendance over time." },
  { icon: FeeIcon, title: "Fees and dues", body: "Create invoices, record full or partial payments, and see which are overdue. Clazzo does not collect payments online; you record what you receive." },
];

export function CenterFeatures() {
  return (
    <section id="institutes" className="section mk-anchor">
      <div className="container">
        <span className="eyebrow mk-eyebrow-block">For institutes</span>
        <h2 className="mk-h2">Run your school, college or centre without the busywork</h2>
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 22 }}>
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card card-lg elev-sm" style={{ gap: 14 }}>
              <div className="mk-icon-tile">
                <Icon size={20} />
              </div>
              <div className="card-title" style={{ fontSize: 17.5 }}>{title}</div>
              <p className="card-body" style={{ fontSize: 14.5 }}>{body}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 32 }}>
          <Link to="/register" className="btn btn-primary btn-lg">Register your institute</Link>
        </p>
      </div>
    </section>
  );
}
