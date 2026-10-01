import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { useAuth } from "../../auth/AuthContext";
import { AsyncState } from "../../components/AsyncState";
import { AttendanceTag } from "../../components/StatusTag";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader, SectionHeader } from "../../components/PageHeader";
import { formatTimeRange, formatWeekday, isoDay, rupees } from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

type ConsentStatus = "NOT_REQUIRED" | "PENDING" | "CONFIRMED" | "REVOKED";

interface Membership {
  institute: { id: string; name: string; type: string };
  groups: { id: string; name: string }[];
  activeCourseCount: number;
  consentStatus: ConsentStatus;
  maskedGuardianEmail: string | null;
  overdueAmount: string;
  attendancePercent: number | null;
}

interface UpcomingSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  subject: string;
  teacher: string | null;
  group: string;
  institute: { id: string; name: string };
}

const LOW_ATTENDANCE_BELOW = 75;

const isGated = (m: Membership) => m.consentStatus === "PENDING" || m.consentStatus === "REVOKED";

function dayLabel(iso: string): string {
  const key = iso.slice(0, 10);
  if (key === isoDay(0)) return `Today · ${formatWeekday(iso)}`;
  if (key === isoDay(1)) return `Tomorrow · ${formatWeekday(iso)}`;
  return formatWeekday(iso);
}

function groupByDay(sessions: UpcomingSession[]) {
  const days: { key: string; date: string; items: UpcomingSession[] }[] = [];
  for (const s of sessions) {
    const key = s.date.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(s);
    else days.push({ key, date: s.date, items: [s] });
  }
  return days;
}

function UpcomingSection({ multipleInstitutes }: { multipleInstitutes: boolean }) {
  const { data, loading, error, reload } = useApiData(() => api.get<UpcomingSession[]>("/api/student/upcoming"));

  return (
    <section style={{ marginBottom: 32 }} aria-labelledby="upcoming-heading">
      <SectionHeader title={<span id="upcoming-heading">Today &amp; this week</span>} />
      <AsyncState loading={loading} error={error} data={data} onRetry={reload}>
        {(sessions) =>
          sessions.length === 0 ? (
            <EmptyState title="No classes scheduled in the next 7 days." />
          ) : (
            <div>
              {groupByDay(sessions).map((day) => (
                <div key={day.key}>
                  <h3 className="portal-day">{dayLabel(day.date)}</h3>
                  <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {day.items.map((s) => {
                      const cancelled = s.status === "CANCELLED";
                      return (
                        <li key={s.id} className={`list-row${cancelled ? " portal-session-cancelled" : ""}`}>
                          <div>
                            <div className="portal-session-title" style={{ fontWeight: 600 }}>
                              {s.subject}
                            </div>
                            <div className="text-muted" style={{ fontSize: 13 }}>
                              {[multipleInstitutes ? s.institute.name : null, s.group, s.teacher].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <div className="row" style={{ gap: 8 }}>
                            {cancelled && <span className="tag tag-danger">Cancelled</span>}
                            <span style={{ fontSize: 14 }}>{formatTimeRange(s.startTime, s.endTime)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )
        }
      </AsyncState>
    </section>
  );
}

function GatedCard({ m }: { m: Membership }) {
  const revoked = m.consentStatus === "REVOKED";
  return (
    <div className="card elev-sm portal-card portal-card-gated" aria-label={`${m.institute.name}: guardian confirmation needed`}>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 18 }}>{m.institute.name}</div>
      {m.groups.length > 0 && (
        <div className="chips">
          {m.groups.map((g) => (
            <span key={g.id} className="tag tag-accent">
              {g.name}
            </span>
          ))}
        </div>
      )}
      <div>
        <span className="tag tag-warning">{revoked ? "Guardian access withdrawn" : "Waiting for your guardian"}</span>
      </div>
      <p style={{ fontSize: 13.5, margin: "4px 0 0" }}>
        {revoked
          ? "Your guardian has withdrawn access, so this institute's classes, attendance and fees are hidden for now."
          : "Because you're under 18, your guardian needs to confirm before you can see classes, attendance and fees here."}
      </p>
      {m.maskedGuardianEmail && (
        <p style={{ fontSize: 13.5, margin: 0 }}>
          We emailed a code to <strong>{m.maskedGuardianEmail}</strong>.
        </p>
      )}
      <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
        Ask your guardian to check their inbox{revoked ? " and confirm again" : ""}, or ask the school to resend the code. Codes work for 48
        hours.
      </p>
    </div>
  );
}

function InstituteCard({ m }: { m: Membership }) {
  const overdue = Number(m.overdueAmount);
  const lowAttendance = m.attendancePercent !== null && m.attendancePercent < LOW_ATTENDANCE_BELOW;
  return (
    <Link to={`/portal/institutes/${m.institute.id}`} className="card card-link elev-sm portal-card">
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 18 }}>{m.institute.name}</div>
      {m.groups.length > 0 && (
        <div className="chips">
          {m.groups.map((g) => (
            <span key={g.id} className="tag tag-accent">
              {g.name}
            </span>
          ))}
        </div>
      )}
      <p className="text-muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
        {m.activeCourseCount} subject{m.activeCourseCount === 1 ? "" : "s"}
      </p>
      {(overdue > 0 || lowAttendance) && (
        <div className="chips" aria-label="Needs attention">
          {overdue > 0 && <span className="tag tag-danger">{rupees(overdue)} overdue</span>}
          {lowAttendance && m.attendancePercent !== null && <AttendanceTag pct={m.attendancePercent} />}
        </div>
      )}
    </Link>
  );
}

export function PortalHome() {
  useDocumentTitle("My institutes");
  const { identity } = useAuth();
  const { data: memberships, loading, error, reload } = useApiData(() => api.get<Membership[]>("/api/student/institutes"));

  return (
    <div>
      <PageHeader
        title="My institutes"
        subtitle="Every school, college or coaching centre that has added you."
      />

      <AsyncState loading={loading} error={error} data={memberships} onRetry={reload}>
        {(memberships) => (
          <>
            {memberships.some((m) => !isGated(m)) && <UpcomingSection multipleInstitutes={memberships.length > 1} />}

            {memberships.length === 0 ? (
              <EmptyState
                title={
                  <>
                    <strong style={{ display: "block", color: "var(--color-text)", marginBottom: 6 }}>
                      No institute has added you yet
                    </strong>
                    <span style={{ display: "block" }}>
                      You're signed in as <strong style={{ color: "var(--color-text)" }}>{identity?.email ?? "this account"}</strong>.
                    </span>
                    <span style={{ display: "block", marginTop: 6 }}>
                      Ask your school, college or coaching centre to add you as a student using exactly this email address. Once they do,
                      it will show up here. If you're under 18, your guardian will also get an email to confirm access.
                    </span>
                  </>
                }
              />
            ) : (
              <section aria-labelledby="institutes-heading">
                <SectionHeader title={<span id="institutes-heading">Your institutes</span>} />
                <div className="portal-grid">
                  {memberships.map((m) => (isGated(m) ? <GatedCard key={m.institute.id} m={m} /> : <InstituteCard key={m.institute.id} m={m} />))}
                </div>
              </section>
            )}
          </>
        )}
      </AsyncState>
    </div>
  );
}
