import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";

interface AttendanceRow {
  id: string;
  status: string;
  classSession: { date: string; orgUnit: { name: string }; course: { name: string } | null };
}

export function AttendanceHistoryPage() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const { data: rows, loading, error, reload } = useApiData(
    () => api.get<AttendanceRow[]>(`/api/student/institutes/${instituteId}/attendance`),
    [instituteId]
  );

  return (
    <div>
      <Link to={`/portal/institutes/${instituteId}`} style={{ fontSize: 13 }}>
        ← Back
      </Link>
      <h1 style={{ fontSize: 26, margin: "10px 0 20px" }}>Attendance history</h1>

      <AsyncState loading={loading} error={error} data={rows} onRetry={reload}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            emptyMessage="No attendance recorded yet."
            columns={[
              { header: "Date", render: (r) => new Date(r.classSession.date).toLocaleDateString() },
              { header: "Subject", render: (r) => r.classSession.course?.name ?? r.classSession.orgUnit.name },
              { header: "Status", render: (r) => r.status },
            ]}
          />
        )}
      </AsyncState>
    </div>
  );
}
