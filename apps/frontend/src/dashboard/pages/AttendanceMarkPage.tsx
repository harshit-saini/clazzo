import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface RosterRow {
  studentId: string;
  studentName: string;
  status: Status | null;
  markedAt: string | null;
}

const STATUSES: Status[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export function AttendanceMarkPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<RosterRow[]>(`/api/sessions/${sessionId}/attendance`).then((rows) => {
      setRoster(rows);
      setDraft(Object.fromEntries(rows.map((r) => [r.studentId, r.status ?? "PRESENT"])));
    });
  }, [sessionId]);

  async function handleSave() {
    setBusy(true);
    try {
      await api.post(`/api/sessions/${sessionId}/attendance`, {
        records: Object.entries(draft).map(([studentId, status]) => ({ studentId, status })),
      });
      navigate(-1);
    } finally {
      setBusy(false);
    }
  }

  function markAll(status: Status) {
    if (!roster) return;
    setDraft(Object.fromEntries(roster.map((r) => [r.studentId, status])));
  }

  if (!roster) return null;

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Mark attendance</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 13, alignSelf: "center", color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
          Mark all:
        </span>
        {STATUSES.map((s) => (
          <button key={s} type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => markAll(s)}>
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
            style={{ padding: "14px 18px", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <span style={{ fontSize: 14.5 }}>{row.studentName}</span>
            <div className="seg">
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
            </div>
          </div>
        ))}
      </div>

      {roster.length > 0 && (
        <button type="button" className="btn btn-primary" style={{ marginTop: 24 }} onClick={handleSave} disabled={busy}>
          {busy ? "Saving…" : "Save attendance"}
        </button>
      )}
    </div>
  );
}
