import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";
import { FormField, Select, TextInput } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { formatDate, formatTimeRange } from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { ConsentPendingBanner } from "../ConsentPendingBanner";

const PAGE_SIZE = 20;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

interface AttendanceRow {
  id: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | string;
  classSession: {
    date: string;
    startTime: string;
    endTime: string;
    orgUnit: { name: string };
    course: { name: string } | null;
  };
}

interface HistoryPage {
  pending: false;
  items: AttendanceRow[];
  total: number;
  subjects: { id: string; name: string }[];
}

interface PendingResult {
  pending: true;
}

const STATUS: Record<string, { label: string; className: string }> = {
  PRESENT: { label: "Present", className: "tag-accent-2" },
  ABSENT: { label: "Absent", className: "tag-danger" },
  LATE: { label: "Late", className: "tag-warning" },
  EXCUSED: { label: "Excused", className: "tag-neutral" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, className: "tag-neutral" };
  return <span className={`tag ${s.className}`}>{s.label}</span>;
}

export function AttendanceHistoryPage() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const [courseId, setCourseId] = useState("");
  const [month, setMonth] = useState("");
  const [skip, setSkip] = useState(0);
  const monthValid = MONTH_RE.test(month);

  // Only used for the breadcrumb/title and the masked guardian email; a
  // failure here must not block the history itself.
  const { data: institute } = useApiData(
    () => api.get<{ institute: { name: string }; maskedGuardianEmail?: string | null; consentStatus: string }>(`/api/student/institutes/${instituteId}`),
    [instituteId]
  );
  const instituteName = institute?.institute.name ?? "Institute";
  useDocumentTitle(`Attendance history · ${instituteName}`);

  const { data, loading, error, reload } = useApiData<HistoryPage | PendingResult>(async () => {
    const params = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(skip) });
    if (courseId) params.set("courseId", courseId);
    if (monthValid) params.set("month", month);
    try {
      const res = await api.get<Omit<HistoryPage, "pending">>(`/api/student/institutes/${instituteId}/attendance?${params}`);
      return { ...res, pending: false as const };
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.data?.code === "CONSENT_PENDING") return { pending: true as const };
      throw err;
    }
  }, [instituteId, courseId, month, skip]);

  const backTo = `/portal/institutes/${instituteId}`;
  const filtered = Boolean(courseId) || monthValid;
  const pendingOnly = data?.pending === true;
  const subjects = data && !data.pending ? data.subjects : [];

  function changeFilter(update: () => void) {
    update();
    setSkip(0);
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "My institutes", to: "/portal" }, { label: instituteName, to: backTo }, { label: "Attendance history" }]}
        title="Attendance history"
        subtitle="Every class you were marked for, newest first."
      />

      {!pendingOnly && (
      <div className="inline-form" style={{ marginTop: 0, marginBottom: 16 }}>
        <FormField label="Subject">
          <Select value={courseId} onChange={(e) => changeFilter(() => setCourseId(e.target.value))}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Month">
          <TextInput
            type="month"
            value={month}
            placeholder="YYYY-MM"
            pattern="\d{4}-(0[1-9]|1[0-2])"
            onChange={(e) => changeFilter(() => setMonth(e.target.value))}
          />
        </FormField>
        {filtered && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginBottom: 14 }}
            onClick={() =>
              changeFilter(() => {
                setCourseId("");
                setMonth("");
              })
            }
          >
            Clear filters
          </button>
        )}
      </div>
      )}

      <AsyncState loading={loading} error={error} data={data} onRetry={reload} backTo={backTo} backLabel="Back">
        {(result) => {
          if (result.pending) {
            return (
              <>
                <ConsentPendingBanner revoked={institute?.consentStatus === "REVOKED"} maskedEmail={institute?.maskedGuardianEmail} />
                <Link to={backTo} className="btn btn-secondary">
                  Back to institute
                </Link>
              </>
            );
          }

          const { items, total } = result;
          const from = total === 0 ? 0 : skip + 1;
          const to = Math.min(skip + items.length, total);

          return (
            <>
              <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                <strong>Present</strong>, <strong>Late</strong> (counts as present), <strong>Absent</strong> and <strong>Excused</strong>.
                Cancelled classes are not listed.
              </p>

              <DataTable
                rows={items}
                rowKey={(r) => r.id}
                caption="Attendance history"
                emptyMessage={filtered ? "No attendance matches these filters." : "No attendance recorded yet."}
                columns={[
                  { header: "Date", primary: true, render: (r) => formatDate(r.classSession.date) },
                  { header: "Time", render: (r) => formatTimeRange(r.classSession.startTime, r.classSession.endTime) },
                  { header: "Subject", render: (r) => r.classSession.course?.name ?? r.classSession.orgUnit.name },
                  { header: "Status", render: (r) => <StatusPill status={r.status} /> },
                ]}
              />

              {total > 0 && (
                <div className="row-between" style={{ marginTop: 16 }}>
                  <span className="text-muted" style={{ fontSize: 13 }} aria-live="polite">
                    Showing {from}–{to} of {total}
                  </span>
                  <div className="row">
                    <button type="button" className="btn btn-secondary btn-sm" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}>
                      Previous
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={skip + PAGE_SIZE >= total} onClick={() => setSkip(skip + PAGE_SIZE)}>
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        }}
      </AsyncState>
    </div>
  );
}
