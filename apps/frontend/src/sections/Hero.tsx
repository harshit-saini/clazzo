import { Link } from "react-router-dom";
import {
  AttendanceIcon,
  CalendarIcon,
  FeeIcon,
  GraduationCapIcon,
  SchoolIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "../icons";

export function Hero() {
  return (
    <header id="hero" className="mk-hero on-surface">
      <div className="mk-hero-blob mk-hero-blob-a" aria-hidden="true" />
      <div className="mk-hero-blob mk-hero-blob-b" aria-hidden="true" />
      <div className="container mk-hero-inner">
        <div className="mk-hero-intro">
          <span className="eyebrow mk-eyebrow-block">For schools, colleges, coaching centres and tutors</span>
          <h1 className="mk-hero-title">Attendance, fees and a student portal, in one place.</h1>
          <p className="mk-lead">
            Clazzo helps your institute mark attendance from a phone, keep track of fees and dues, and give every
            student a login to see their classes, attendance and fees.
          </p>
        </div>

        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          <div className="mk-panel mk-panel-a">
            <div className="mk-panel-icon">
              <SchoolIcon size={26} />
            </div>
            <h2>Run your school, college or centre.</h2>
            <p>
              Set up your classes, batches or groups, add students and subjects, and keep the day-to-day work out of
              spreadsheets.
            </p>
            <div className="mk-checks">
              <div className="mk-check">
                <UsersIcon size={17} color="var(--color-accent-700)" />
                A structure that fits how you teach
              </div>
              <div className="mk-check">
                <AttendanceIcon size={17} color="var(--color-accent-700)" />
                Attendance marked on a phone
              </div>
              <div className="mk-check">
                <FeeIcon size={17} color="var(--color-accent-700)" />
                Invoices, payments and overdue fees
              </div>
            </div>
            <div className="mk-cta-row">
              <Link to="/register" className="btn btn-primary btn-lg">
                Register your institute
              </Link>
            </div>
          </div>

          <div className="mk-panel mk-panel-b">
            <div className="mk-panel-icon">
              <GraduationCapIcon size={26} />
            </div>
            <h2>Students get their own view.</h2>
            <p>
              Once an institute adds you, log in with your email to see your classes, attendance and fees, across
              every institute you belong to.
            </p>
            <div className="mk-checks">
              <div className="mk-check">
                <CalendarIcon size={17} color="var(--color-accent-2-700)" />
                Classes this week, including cancellations
              </div>
              <div className="mk-check">
                <AttendanceIcon size={17} color="var(--color-accent-2-700)" />
                Attendance history and fee status
              </div>
              <div className="mk-check">
                <ShieldCheckIcon size={17} color="var(--color-accent-2-700)" />
                Guardian consent for students under 18
              </div>
            </div>
            <div className="mk-cta-row">
              <Link to="/student/signup" className="btn btn-sage btn-lg">
                Student sign up
              </Link>
              <Link to="/login" className="btn btn-secondary btn-lg">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
