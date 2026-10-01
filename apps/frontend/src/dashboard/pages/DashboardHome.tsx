import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { formatTimeRange, formatWeekday, isoDay, rupees } from "../../lib/format";
import { AsyncState } from "../../components/AsyncState";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { PageHeader, SectionHeader } from "../../components/PageHeader";

interface Summary {
  activeStudentCount: number;
  activeUnitCount: number;
  activeCourseCount: number;
  todaysSessionCount: number;
  unmarkedSessionCount: number;
  // Fee totals are null for a TEACHER — the API withholds them.
  outstandingInvoiceCount: number | null;
  outstandingInvoiceTotal: string | null;
  overdueInvoiceCount: number | null;
  overdueInvoiceTotal: string | null;
  collectedThisMonthTotal: string | null;
}

interface SessionRow {
  id: string;
  date: string;
  orgUnit: { id: string; name: string };
  course: { id: string; name: string; teacher: { id: string; name: string } | null } | null;
  startTime: string;
  endTime: string;
  enrolledCount: number;
  markedCount: number;
}

type View = "today" | "yesterday" | "unmarked";

const VIEWS: { key: View; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "unmarked", label: "Unmarked, last 7 days" },
];

function sessionsUrl(view: View) {
  if (view === "today") return "/api/dashboard/today";
  if (view === "yesterday") return `/api/dashboard/today?date=${isoDay(-1)}`;
  return `/api/dashboard/today?from=${isoDay(-7)}&to=${isoDay(0)}&unmarked=1`;
}

// For today's classes, comparing HH:mm against the clock is enough to tell
// whether an unmarked slot has already passed; earlier days are always late.
function isLate(session: SessionRow) {
  if (session.markedCount >= session.enrolledCount) return false;
  const today = isoDay(0);
  const day = session.date.slice(0, 10);
  if (day < today) return true;
  if (day > today) return false;
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return session.endTime < nowTime;
}

export function DashboardHome() {
  useDocumentTitle("Dashboard");
  const { identity } = useAuth();
  const role = identity?.kind === "STAFF" ? identity.role : null;
  const firstName = identity?.name?.split(" ")[0];

  const { data: summary, loading, error, reload } = useApiData<Summary>(() => api.get<Summary>("/api/dashboard/summary"));

  return (
    <div>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : "Dashboard"}
        subtitle={role === "TEACHER" ? "Your classes and who still needs marking." : role === "ACCOUNTANT" ? "Fees at a glance." : "How the institute is doing today."}
      />

      <AsyncState loading={loading} error={error} data={summary} onRetry={reload}>
        {(summary) =>
          role === "ACCOUNTANT" ? (
            <AccountantView summary={summary} />
          ) : summary.activeUnitCount === 0 && summary.activeStudentCount === 0 ? (
            <SetupChecklist isOwner={role === "OWNER"} />
          ) : (
            <>
              <div className="stat-grid" style={{ marginBottom: 28 }}>
                <StatCard
                  label="Not yet marked today"
                  value={summary.unmarkedSessionCount}
                  sentiment={summary.unmarkedSessionCount > 0 ? "bad" : "good"}
                />
                <StatCard label="Active students" value={summary.activeStudentCount} />
                <StatCard label="Subjects" value={summary.activeCourseCount} accent="accent-2" />
                {summary.overdueInvoiceTotal !== null && (
                  <StatCard
                    label="Overdue fees"
                    value={rupees(summary.overdueInvoiceTotal)}
                    sentiment={Number(summary.overdueInvoiceTotal) > 0 ? "bad" : "good"}
                  />
                )}
                {summary.outstandingInvoiceTotal !== null && <StatCard label="Outstanding fees" value={rupees(summary.outstandingInvoiceTotal)} />}
                {summary.collectedThisMonthTotal !== null && (
                  <StatCard label="Collected this month" value={rupees(summary.collectedThisMonthTotal)} accent="accent-2" />
                )}
              </div>
              <ClassesSection isTeacher={role === "TEACHER"} />
            </>
          )
        }
      </AsyncState>
    </div>
  );
}

function ClassesSection({ isTeacher }: { isTeacher: boolean }) {
  const [view, setView] = useState<View>("today");
  const { data, loading, error, reload } = useApiData<SessionRow[]>(() => api.get<SessionRow[]>(sessionsUrl(view)), [view]);

  return (
    <section aria-labelledby="classes-heading">
      <SectionHeader title={<span id="classes-heading">{isTeacher ? "My classes" : "Classes"}</span>} />
      <div className="chips" role="group" aria-label="Which classes to show" style={{ marginBottom: 14 }}>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className={"chip"}
            aria-pressed={view === v.key}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <AsyncState loading={loading} error={error} data={data} onRetry={reload}>
        {(sessions) => (
          <DataTable
            caption="Classes"
            rows={sessions}
            rowKey={(s) => s.id}
            emptyMessage={
              view === "unmarked"
                ? "Nothing outstanding — every class from the last 7 days has attendance marked."
                : view === "yesterday"
                  ? "No classes were scheduled yesterday."
                  : "No classes scheduled today."
            }
            columns={[
              ...(view === "unmarked" ? [{ header: "Date", render: (s: SessionRow) => formatWeekday(s.date) }] : []),
              { header: "Time", render: (s) => formatTimeRange(s.startTime, s.endTime) },
              { header: "Group", primary: true, render: (s) => <Link to={`/dashboard/structure/${s.orgUnit.id}`}>{s.orgUnit.name}</Link> },
              { header: "Subject", render: (s) => s.course?.name ?? "Whole group" },
              ...(isTeacher ? [] : [{ header: "Teacher", render: (s: SessionRow) => s.course?.teacher?.name ?? "—" }]),
              {
                header: "Attendance",
                render: (s) => {
                  const pct = s.enrolledCount > 0 ? Math.round((s.markedCount / s.enrolledCount) * 100) : 0;
                  return (
                    <div className="row" style={{ minWidth: 130 }}>
                      <div className="mini-progress" aria-hidden="true">
                        <div className="mini-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {s.markedCount} of {s.enrolledCount} marked
                      </span>
                      {isLate(s) && <span className="tag tag-danger">Overdue</span>}
                    </div>
                  );
                },
              },
              {
                header: "",
                srHeader: "Open",
                render: (s) => (
                  <Link
                    to={`/dashboard/attendance/${s.id}`}
                    className="btn btn-secondary btn-sm"
                    aria-label={`${s.markedCount < s.enrolledCount ? "Mark" : "View"} attendance, ${s.orgUnit.name} ${s.course?.name ?? ""}`.trim()}
                  >
                    {s.markedCount < s.enrolledCount ? "Mark attendance" : "View"}
                  </Link>
                ),
              },
            ]}
          />
        )}
      </AsyncState>
    </section>
  );
}

function AccountantView({ summary }: { summary: Summary }) {
  return (
    <>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label="Overdue"
          value={rupees(summary.overdueInvoiceTotal ?? 0)}
          sentiment={Number(summary.overdueInvoiceTotal ?? 0) > 0 ? "bad" : "good"}
        />
        <StatCard label="Outstanding" value={rupees(summary.outstandingInvoiceTotal ?? 0)} />
        <StatCard label="Collected this month" value={rupees(summary.collectedThisMonthTotal ?? 0)} accent="accent-2" />
      </div>
      <div className="row">
        <Link to="/dashboard/fees?status=OVERDUE" className="btn btn-primary">
          See overdue invoices ({summary.overdueInvoiceCount ?? 0})
        </Link>
        <Link to="/dashboard/fees" className="btn btn-secondary">
          All invoices
        </Link>
      </div>
    </>
  );
}

const SETUP_STEPS = [
  {
    title: "Set up your structure",
    body: "Define how your institute is arranged — classes, batches, sections, whatever fits.",
    to: "/dashboard/structure",
    label: "Go to Structure",
    ownerOnly: true,
  },
  {
    title: "Add your students",
    body: "Add students one at a time, or paste a whole class from a spreadsheet.",
    to: "/dashboard/students",
    label: "Go to Students",
  },
  {
    title: "Add subjects and a timetable",
    body: "Attach subjects to a group and assign a teacher, so schedules and attendance have something to track.",
    to: "/dashboard/courses",
    label: "Go to Subjects",
  },
];

/** A brand-new institute would otherwise see four zero-value stat cards and
 * "No classes scheduled," which reads like a quiet day rather than "nothing
 * is set up yet." This is a concrete first-run checklist instead. */
function SetupChecklist({ isOwner }: { isOwner: boolean }) {
  const steps = SETUP_STEPS.filter((s) => isOwner || !s.ownerOnly);
  return (
    <div>
      <p className="text-muted" style={{ marginBottom: 24, maxWidth: 520 }}>
        Welcome to Clazzo! Here's the order that gets you up and running fastest.
      </p>
      <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0, maxWidth: 560 }}>
        {steps.map((step, i) => (
          <li key={step.to} className="card card-md list-row">
            <span className="step-dot" aria-hidden="true">{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 16.5, marginBottom: 2 }}>{step.title}</div>
              <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>{step.body}</p>
            </div>
            <Link to={step.to} className="btn btn-secondary" style={{ flexShrink: 0 }}>
              {step.label}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
