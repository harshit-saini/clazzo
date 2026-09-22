import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { DataTable } from "../../components/DataTable";

interface AttendanceRow {
  id: string;
  status: string;
  classSession: { date: string; batch: { name: string; subject: string | null } };
}

export function AttendanceHistoryPage() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const [rows, setRows] = useState<AttendanceRow[] | null>(null);

  useEffect(() => {
    api.get<AttendanceRow[]>(`/api/student/institutes/${instituteId}/attendance`).then(setRows);
  }, [instituteId]);

  if (!rows) return null;

  return (
    <div>
      <Link to={`/portal/institutes/${instituteId}`} style={{ fontSize: 13 }}>
        ← Back
      </Link>
      <h1 style={{ fontSize: 26, margin: "10px 0 20px" }}>Attendance history</h1>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No attendance recorded yet."
        columns={[
          { header: "Date", render: (r) => new Date(r.classSession.date).toLocaleDateString() },
          { header: "Course", render: (r) => r.classSession.batch.name },
          { header: "Status", render: (r) => r.status },
        ]}
      />
    </div>
  );
}
