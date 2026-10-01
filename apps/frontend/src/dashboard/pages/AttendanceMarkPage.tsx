import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useOnline } from "../../lib/useOnline";
import { formatDate, formatTimeRange } from "../../lib/format";
import { AsyncState } from "../../components/AsyncState";
import { PageHeader } from "../../components/PageHeader";
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

const STATUSES: { status: Status; label: string; short: string; key: string }[] = [
  { status: "PRESENT", label: "Present", short: "P", key: "p" },
  { status: "ABSENT", label: "Absent", short: "A", key: "a" },
  { status: "LATE", label: "Late", short: "L", key: "l" },
  { status: "EXCUSED", label: "Excused", short: "E", key: "e" },
];

type Draft = Record<string, Status>;

interface StoredDraft {
  statuses: Draft;
  /** True when a save failed for lack of a connection and is waiting to be re-sent. */
  queued: boolean;
}

const draftKey = (sessionId: string) => `clazzo_att_draft_${sessionId}`;

function loadDraft(sessionId: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(sessionId));
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function sameDraft(a: Draft, b: Draft) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

export function AttendanceMarkPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const { data, loading, error, reload } = useApiData(
    () => api.get<AttendanceData>(`/api/sessions/${sessionId}/attendance`),
    [sessionId]
  );
  useDocumentTitle(data ? `Attendance — ${data.session.orgUnit.name}` : "Attendance");

  return (
    <AsyncState loading={loading} error={error} data={data} onRetry={reload} backTo="/dashboard" backLabel="Back to dashboard">
      {(d) => <MarkSheet key={sessionId} sessionId={sessionId} data={d} />}
    </AsyncState>
  );
}

function MarkSheet({ sessionId, data }: { sessionId: string; data: AttendanceData }) {
  const { session, roster } = data;
  const navigate = useNavigate();
  const showToast = useToast();
  const online = useOnline();

  // What the server has (or "Present" for anyone not marked yet).
  const baseline = useMemo<Draft>(
    () => Object.fromEntries(roster.map((r) => [r.studentId, r.status ?? "PRESENT"])),
    [roster]
  );
  const alreadyMarked = roster.some((r) => r.status !== null);

  // An unfinished draft from an earlier visit (a closed tab, a dead
  // connection) is restored instead of being thrown away.
  const stored = useMemo(() => loadDraft(sessionId), [sessionId]);
  const restorable = stored && !sameDraft({ ...baseline, ...stored.statuses }, baseline);
  const [draft, setDraft] = useState<Draft>(restorable ? { ...baseline, ...stored.statuses } : baseline);
  const [restored, setRestored] = useState(Boolean(restorable));
  const [queued, setQueued] = useState(Boolean(restorable && stored.queued));
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = !sameDraft(draft, baseline);
  const savingRef = useRef(false);

  // Persist the draft as it changes; clear it once it matches the server.
  useEffect(() => {
    if (dirty) localStorage.setItem(draftKey(sessionId), JSON.stringify({ statuses: draft, queued } satisfies StoredDraft));
    else localStorage.removeItem(draftKey(sessionId));
  }, [draft, queued, dirty, sessionId]);

  // Warn before closing the tab with marks that haven't been saved.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      await api.post(`/api/sessions/${sessionId}/attendance`, {
        records: Object.entries(draft).map(([studentId, status]) => ({ studentId, status })),
      });
      localStorage.removeItem(draftKey(sessionId));
      setQueued(false);
      showToast(queued ? "Attendance sent — it was waiting for a connection." : "Attendance saved.");
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        // No connection: keep the marks on this device and send them when
        // the network is back, rather than losing a class's attendance.
        setQueued(true);
        setSaveError("You're offline. Your marks are kept on this device and will be sent when you're back online.");
      } else {
        setSaveError(err instanceof ApiError ? err.message : "Could not save attendance. Please try again.");
      }
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }, [draft, navigate, queued, sessionId, showToast]);

  // Back online with a queued save: send it.
  useEffect(() => {
    if (online && queued && dirty) void save();
  }, [online, queued, dirty, save]);

  function set(studentId: string, status: Status) {
    setDraft((d) => ({ ...d, [studentId]: status }));
    setRestored(false);
  }

  function markAll(status: Status) {
    setDraft(Object.fromEntries(roster.map((r) => [r.studentId, status])));
    setRestored(false);
  }

  function discardDraft() {
    setDraft(baseline);
    setQueued(false);
    setRestored(false);
    setSaveError(null);
  }

  const tally = STATUSES.map((s) => ({ ...s, count: Object.values(draft).filter((v) => v === s.status).length }));

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: session.orgUnit.name, to: `/dashboard/structure/${session.orgUnit.id}` },
          { label: "Attendance" },
        ]}
        title={alreadyMarked ? "Edit attendance" : "Mark attendance"}
        subtitle={`${session.course?.name ?? "Whole group"} · ${session.orgUnit.name} · ${formatDate(session.date)} · ${formatTimeRange(session.startTime, session.endTime)}`}
      />

      {alreadyMarked && !dirty && (
        <p className="banner banner-info" role="status">
          Attendance was already saved for this class. Change anyone below and save to update it.
        </p>
      )}
      {restored && (
        <div className="banner banner-warning" role="status">
          <span>
            {queued ? "These marks are waiting to be sent." : "We restored the marks you hadn't saved yet."}
          </span>{" "}
          <button type="button" className="btn btn-ghost btn-sm" onClick={discardDraft}>
            Discard them
          </button>
        </div>
      )}

      {roster.length === 0 ? (
        <p className="banner banner-info">Nobody is on this class's roster yet. Enrol students in the group or subject first.</p>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
            <span className="text-muted" style={{ fontSize: 13 }}>Everyone starts as Present — change the exceptions. Mark all as:</span>
            {STATUSES.map((s) => (
              <button key={s.status} type="button" className="btn btn-secondary btn-sm" onClick={() => markAll(s.status)}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-muted" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
            Keyboard: focus a student and press P, A, L or E.
          </p>

          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {roster.map((row) => (
              <li
                key={row.studentId}
                className="att-row"
                onKeyDown={(e) => {
                  if (e.ctrlKey || e.metaKey || e.altKey) return;
                  if ((e.target as HTMLElement).tagName === "INPUT" && !["p", "a", "l", "e"].includes(e.key.toLowerCase())) return;
                  const match = STATUSES.find((s) => s.key === e.key.toLowerCase());
                  if (match) {
                    e.preventDefault();
                    set(row.studentId, match.status);
                  }
                }}
              >
                <div className="att-name">
                  {row.studentName}
                  {row.markedAt && draft[row.studentId] === row.status && <span className="tag tag-outline">Saved</span>}
                </div>
                <fieldset className="att-options">
                  <legend className="sr-only">Attendance for {row.studentName}</legend>
                  {STATUSES.map((s) => (
                    <label key={s.status} className="att-opt">
                      <input
                        type="radio"
                        name={`status-${row.studentId}`}
                        checked={draft[row.studentId] === s.status}
                        onChange={() => set(row.studentId, s.status)}
                        aria-label={`${s.label}: ${row.studentName}`}
                      />
                      <span className="att-full" aria-hidden="true">{s.label}</span>
                      <span className="att-short" aria-hidden="true">{s.short}</span>
                    </label>
                  ))}
                </fieldset>
              </li>
            ))}
          </ul>

          <div className="sticky-bar">
            <div role="status" aria-live="polite" style={{ fontSize: 13 }}>
              {tally.map((t) => (
                <span key={t.status} style={{ marginRight: 12 }}>
                  <strong>{t.count}</strong> {t.label.toLowerCase()}
                </span>
              ))}
              {dirty && <span className="tag tag-warning">Unsaved changes</span>}
            </div>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || (!dirty && alreadyMarked)}>
              {busy ? "Saving…" : queued ? "Send now" : alreadyMarked ? "Update attendance" : "Save attendance"}
            </button>
          </div>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
        </>
      )}
    </div>
  );
}
