import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { useToast } from "../../components/ToastContext";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface RosterRow {
  studentId: string;
  studentName: string;
  status: Status | null;
  markedAt: string | null;
}

interface SessionInfo {
  date: string;
  startTime: string;
  endTime: string;
  orgUnit: { id: string; name: string };
  course: { id: string; name: string } | null;
}

interface AttendanceData {
  session: SessionInfo;
  roster: RosterRow[];
}

const STATUSES: Status[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export function AttendanceMarkPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const showToast = useToast();
  const { data, loading, error, reload } = useApiData(
    () => api.get<AttendanceData>(`/api/sessions/${sessionId}/attendance`),
    [sessionId]
  );
  const [draft, setDraft] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.roster.map((r) => [r.studentId, r.status ?? "PRESENT"])));
  }, [data]);

  async function handleSave() {
    setBusy(true);
    setSaveError(null);
    try {
      await api.post(`/api/sessions/${sessionId}/attendance`, {
        records: Object.entries(draft).map(([studentId, status]) => ({ studentId, status })),
      });
      showToast("Attendance saved.");
      navigate(-1);
    } catch {
      setSaveError("Could not save attendance. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function markAll(status: Status, roster: RosterRow[]) {
    setDraft(Object.fromEntries(roster.map((r) => [r.studentId, status])));
  }

  return (
    <AsyncState loading={loading} error={error} data={data} onRetry={reload}>
      {({ session, roster }) => (
        <div>
          <p style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 2 }}>
            <Link to={`/dashboard/structure/${session.orgUnit.id}`}>{session.orgUnit.name}</Link>
          </p>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Mark attendance</h1>
          <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 20 }}>
            {session.course?.name ?? "Whole group"} · {new Date(session.date).toLocaleDateString()} · {session.startTime}–{session.endTime}
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, alignSelf: "center", color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
              Mark all:
            </span>
            {STATUSES.map((s) => (
              <button key={s} type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => markAll(s, roster)}>
                {s}
              </button>
            ))}
          </div>

          {roster.length === 0 && <p>Nobody is on this session's roster yet.</p>}

          <div style={{ display: "grid", gap: 10 }}>
            {roster.map((row) => (
              <div
                key={row.studentId}
                className="card"
                style={{ padding: "14px 18px", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}
              >
                <span style={{ fontSize: 14.5 }}>{row.studentName}</span>
                <fieldset className="seg" style={{ flexWrap: "wrap", border: "none", padding: 0, margin: 0 }}>
                  <legend className="sr-only">Attendance status for {row.studentName}</legend>
                  {STATUSES.map((s) => (
                    <label key={s} className="seg-opt">
                      <input
                        type="radio"
                        name={`status-${row.studentId}`}
                        checked={draft[row.studentId] === s}
                        onChange={() => setDraft({ ...draft, [row.studentId]: s })}
                      />
                      {s}
                    </label>
                  ))}
                </fieldset>
              </div>
            ))}
          </div>

          {saveError && <p style={{ color: "var(--color-danger)", fontSize: 13, marginTop: 12 }}>{saveError}</p>}

          {roster.length > 0 && (
            <button type="button" className="btn btn-primary" style={{ marginTop: 24 }} onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : "Save attendance"}
            </button>
          )}
        </div>
      )}
    </AsyncState>
  );
}
