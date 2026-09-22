import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { DataTable } from "../../components/DataTable";
import { FormField, Select, TextInput } from "../../components/FormField";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ScheduleSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface ClassSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface FeeStructure {
  amount: string;
  billingCycle: string;
  dueDayOfMonth: number | null;
}

interface BatchDetail {
  id: string;
  name: string;
  subject: string | null;
  primaryTeacher: { id: string; name: string } | null;
  grade: { id: string; name: string } | null;
  scheduleSlots: ScheduleSlot[];
  feeStructure: FeeStructure | null;
  enrollments: { student: { id: string; name: string; phone: string | null } }[];
}

interface StudentOption {
  id: string;
  name: string;
}

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);

  function load() {
    api.get<BatchDetail>(`/api/batches/${id}`).then(setBatch);
    api.get<ClassSession[]>(`/api/batches/${id}/sessions`).then(setSessions);
  }

  useEffect(() => {
    load();
    api.get<StudentOption[]>("/api/students").then(setAllStudents);
  }, [id]);

  if (!batch) return null;

  const enrolledIds = new Set(batch.enrollments.map((e) => e.student.id));
  const notEnrolled = allStudents.filter((s) => !enrolledIds.has(s.id));

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{batch.name}</h1>
      <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 28 }}>
        {batch.subject ?? "No subject"} · {batch.primaryTeacher?.name ?? "No teacher assigned"} ·{" "}
        {batch.grade?.name ?? "No grade"}
      </p>

      <ScheduleSection batchId={batch.id} slots={batch.scheduleSlots} onChanged={load} />
      <SessionsSection batchId={batch.id} sessions={sessions} onChanged={() => api.get<ClassSession[]>(`/api/batches/${id}/sessions`).then(setSessions)} />
      <EnrollmentSection batchId={batch.id} enrolled={batch.enrollments} notEnrolled={notEnrolled} onChanged={load} />
      <FeeStructureSection batchId={batch.id} structure={batch.feeStructure} onChanged={load} />
    </div>
  );
}

function ScheduleSection({ batchId, slots, onChanged }: { batchId: string; slots: ScheduleSlot[]; onChanged: () => void }) {
  const [form, setForm] = useState({ dayOfWeek: "1", startTime: "16:00", endTime: "17:00" });
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/api/batches/${batchId}/schedule`, {
        dayOfWeek: Number(form.dayOfWeek),
        startTime: form.startTime,
        endTime: form.endTime,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add schedule slot.");
    }
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Weekly schedule</h2>
      <DataTable
        rows={slots}
        rowKey={(s) => s.id}
        emptyMessage="No recurring schedule set."
        columns={[
          { header: "Day", render: (s) => DAYS[s.dayOfWeek] },
          { header: "Time", render: (s) => `${s.startTime} – ${s.endTime}` },
          {
            header: "",
            render: (s) => (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 13, padding: 0 }}
                onClick={() => api.delete(`/api/schedule/${s.id}`).then(onChanged)}
              >
                Remove
              </button>
            ),
          },
        ]}
      />
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 14 }}>
        <FormField label="Day">
          <Select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Start">
          <TextInput type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        </FormField>
        <FormField label="End">
          <TextInput type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </FormField>
        <button type="submit" className="btn btn-primary" style={{ height: 36 }}>
          Add
        </button>
      </form>
      {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
    </section>
  );
}

function SessionsSection({ batchId, sessions, onChanged }: { batchId: string; sessions: ClassSession[]; onChanged: () => void }) {
  const [range, setRange] = useState({ fromDate: "", toDate: "" });
  const [busy, setBusy] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/batches/${batchId}/sessions/generate`, range);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const upcoming = sessions.filter((s) => s.status === "SCHEDULED").slice(0, 10);

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Class sessions</h2>
      <form onSubmit={handleGenerate} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
        <FormField label="From">
          <TextInput type="date" required value={range.fromDate} onChange={(e) => setRange({ ...range, fromDate: e.target.value })} />
        </FormField>
        <FormField label="To">
          <TextInput type="date" required value={range.toDate} onChange={(e) => setRange({ ...range, toDate: e.target.value })} />
        </FormField>
        <button type="submit" className="btn btn-secondary" style={{ height: 36 }} disabled={busy}>
          {busy ? "Generating…" : "Generate sessions"}
        </button>
      </form>
      <DataTable
        rows={upcoming}
        rowKey={(s) => s.id}
        emptyMessage="No sessions generated yet — set a weekly schedule above, then generate a date range."
        columns={[
          { header: "Date", render: (s) => new Date(s.date).toLocaleDateString() },
          { header: "Time", render: (s) => `${s.startTime} – ${s.endTime}` },
          {
            header: "",
            render: (s) => (
              <Link to={`/dashboard/attendance/${s.id}`} className="btn btn-ghost" style={{ fontSize: 13, padding: 0 }}>
                Mark attendance
              </Link>
            ),
          },
        ]}
      />
    </section>
  );
}

function EnrollmentSection({
  batchId,
  enrolled,
  notEnrolled,
  onChanged,
}: {
  batchId: string;
  enrolled: { student: { id: string; name: string; phone: string | null } }[];
  notEnrolled: StudentOption[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState("");

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await api.post(`/api/batches/${batchId}/enroll`, { studentId: selected });
    setSelected("");
    onChanged();
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Enrolled students</h2>
      <DataTable
        rows={enrolled}
        rowKey={(e) => e.student.id}
        emptyMessage="No students enrolled yet."
        columns={[
          { header: "Name", render: (e) => <Link to={`/dashboard/students/${e.student.id}`}>{e.student.name}</Link> },
          { header: "Phone", render: (e) => e.student.phone ?? "—" },
          {
            header: "",
            render: (e) => (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 13, padding: 0 }}
                onClick={() => api.delete(`/api/batches/${batchId}/enroll/${e.student.id}`).then(onChanged)}
              >
                Remove
              </button>
            ),
          },
        ]}
      />
      {notEnrolled.length > 0 && (
        <form onSubmit={handleEnroll} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 14 }}>
          <FormField label="Enroll a student">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Choose…</option>
              {notEnrolled.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <button type="submit" className="btn btn-primary" style={{ height: 36 }} disabled={!selected}>
            Enroll
          </button>
        </form>
      )}
    </section>
  );
}

function FeeStructureSection({ batchId, structure, onChanged }: { batchId: string; structure: FeeStructure | null; onChanged: () => void }) {
  const [form, setForm] = useState({
    amount: structure?.amount ?? "",
    billingCycle: structure?.billingCycle ?? "MONTHLY",
  });
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/api/batches/${batchId}/fee-structure`, { amount: Number(form.amount), billingCycle: form.billingCycle });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Fee structure</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: 420 }}>
        <FormField label="Amount (₹)">
          <TextInput type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </FormField>
        <FormField label="Billing cycle">
          <Select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
            <option value="ONE_TIME">One-time</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
          </Select>
        </FormField>
        <button type="submit" className="btn btn-primary" style={{ height: 36 }} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}
