import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";

interface Summary {
  activeStudentCount: number;
  activeUnitCount: number;
  activeCourseCount: number;
  todaysSessionCount: number;
  unmarkedSessionCount: number;
  outstandingInvoiceCount: number;
  outstandingInvoiceTotal: string;
  collectedThisMonthTotal: string;
}

interface TodaySession {
  id: string;
  orgUnit: { id: string; name: string };
  course: { id: string; name: string; teacher: { id: string; name: string } | null } | null;
  startTime: string;
  endTime: string;
  enrolledCount: number;
  markedCount: number;
}

interface DashboardData {
  summary: Summary;
  sessions: TodaySession[];
}

export function DashboardHome() {
  const { data, loading, error, reload } = useApiData<DashboardData>(() =>
    Promise.all([api.get<Summary>("/api/dashboard/summary"), api.get<TodaySession[]>("/api/dashboard/today")]).then(
      ([summary, sessions]) => ({ summary, sessions })
    )
  );

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Dashboard</h1>

      <AsyncState loading={loading} error={error} data={data} onRetry={reload}>
        {({ summary, sessions }) =>
          summary.activeUnitCount === 0 && summary.activeStudentCount === 0 ? (
            <SetupChecklist />
          ) : (
          <>
            <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
              <StatCard label="Active students" value={summary.activeStudentCount} />
              <StatCard label="Subjects" value={summary.activeCourseCount} accent="accent-2" />
              <StatCard label="Outstanding dues" value={`₹${summary.outstandingInvoiceTotal}`} />
              <StatCard label="Collected this month" value={`₹${summary.collectedThisMonthTotal}`} accent="accent-2" />
            </div>

            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Today's classes ({summary.unmarkedSessionCount} not yet marked)</h2>
            <DataTable
              rows={sessions}
              rowKey={(s) => s.id}
              emptyMessage="No classes scheduled today."
              columns={[
                { header: "Time", render: (s) => `${s.startTime} – ${s.endTime}` },
                { header: "Group", render: (s) => s.orgUnit.name },
                { header: "Subject", render: (s) => s.course?.name ?? "Whole group" },
                { header: "Teacher", render: (s) => s.course?.teacher?.name ?? "—" },
                { header: "Attendance", render: (s) => `${s.markedCount} / ${s.enrolledCount} marked` },
                {
                  header: "",
                  render: (s) => (
                    <Link to={`/dashboard/attendance/${s.id}`} className="btn btn-ghost" style={{ fontSize: 13 }}>
                      {s.markedCount < s.enrolledCount ? "Mark attendance" : "View"}
                    </Link>
                  ),
                },
              ]}
            />
          </>
          )
        }
      </AsyncState>
    </div>
  );
}

const SETUP_STEPS = [
  {
    title: "Set up your structure",
    body: "Define how your organization is arranged — classes, batches, sections, whatever fits.",
    to: "/dashboard/structure",
    label: "Go to Structure",
  },
  {
    title: "Add your students",
    body: "Add students one at a time, or invite them to their own portal.",
    to: "/dashboard/students",
    label: "Go to Students",
  },
  {
    title: "Add subjects",
    body: "Attach subjects to a group and assign a teacher, so schedules and attendance have something to track.",
    to: "/dashboard/courses",
    label: "Go to Subjects",
  },
];

/** A brand-new institute used to land on the same dashboard as an
 * established one — four zero-value stat cards and "No classes scheduled
 * today," which reads like a quiet day rather than "nothing is set up
 * yet." This replaces that with a concrete first-run checklist. */
function SetupChecklist() {
  return (
    <div>
      <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 24, maxWidth: 520 }}>
        Welcome to Clazzo! Here's the order that gets you up and running fastest.
      </p>
      <div style={{ display: "grid", gap: 14, maxWidth: 560 }}>
        {SETUP_STEPS.map((step, i) => (
          <div key={step.to} className="card elev-sm" style={{ padding: 20, flexDirection: "row", alignItems: "center", gap: 16 }}>
            <div
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--color-accent-100)",
                color: "var(--color-accent-800)",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 16.5, marginBottom: 2 }}>{step.title}</div>
              <p style={{ margin: 0, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>{step.body}</p>
            </div>
            <Link to={step.to} className="btn btn-secondary" style={{ flexShrink: 0 }}>
              {step.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
