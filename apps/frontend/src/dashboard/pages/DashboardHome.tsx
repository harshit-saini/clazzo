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
        {({ summary, sessions }) => (
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
                    <Link to={`/dashboard/attendance/${s.id}`} className="btn btn-ghost" style={{ fontSize: 13, padding: 0 }}>
                      {s.markedCount < s.enrolledCount ? "Mark attendance" : "View"}
                    </Link>
                  ),
                },
              ]}
            />
          </>
        )}
      </AsyncState>
    </div>
  );
}
