import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";

interface Summary {
  activeStudentCount: number;
  activeBatchCount: number;
  todaysSessionCount: number;
  unmarkedSessionCount: number;
  outstandingInvoiceCount: number;
  outstandingInvoiceTotal: string;
  collectedThisMonthTotal: string;
}

interface TodaySession {
  id: string;
  batch: { id: string; name: string; subject: string | null; primaryTeacher: { id: string; name: string } | null };
  startTime: string;
  endTime: string;
  enrolledCount: number;
  markedCount: number;
}

export function DashboardHome() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sessions, setSessions] = useState<TodaySession[] | null>(null);

  useEffect(() => {
    api.get<Summary>("/api/dashboard/summary").then(setSummary);
    api.get<TodaySession[]>("/api/dashboard/today").then(setSessions);
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Dashboard</h1>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          <StatCard label="Active students" value={summary.activeStudentCount} />
          <StatCard label="Active batches" value={summary.activeBatchCount} accent="accent-2" />
          <StatCard label="Outstanding dues" value={`₹${summary.outstandingInvoiceTotal}`} />
          <StatCard label="Collected this month" value={`₹${summary.collectedThisMonthTotal}`} accent="accent-2" />
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>
        Today's classes{summary ? ` (${summary.unmarkedSessionCount} not yet marked)` : ""}
      </h2>
      {sessions && (
        <DataTable
          rows={sessions}
          rowKey={(s) => s.id}
          emptyMessage="No classes scheduled today."
          columns={[
            { header: "Time", render: (s) => `${s.startTime} – ${s.endTime}` },
            { header: "Batch", render: (s) => s.batch.name },
            { header: "Teacher", render: (s) => s.batch.primaryTeacher?.name ?? "—" },
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
      )}
    </div>
  );
}
