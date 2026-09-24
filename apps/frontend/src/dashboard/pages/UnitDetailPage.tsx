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
  course: { id: string; name: string } | null;
}

interface ClassSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  course: { id: string; name: string } | null;
}

interface FeeStructure {
  amount: string;
  billingCycle: string;
  dueDayOfMonth: number | null;
}

interface CourseRow {
  id: string;
  name: string;
  code: string | null;
  enrollmentMode: "ALL_IN_UNIT" | "SELECTED";
  inherited: boolean;
  teacher: { id: string; name: string } | null;
  orgUnit: { id: string; name: string };
}

interface UnitDetail {
  id: string;
  name: string;
  depth: number;
  level: { name: string } | null;
  ancestors: { id: string; name: string }[];
  children: { id: string; name: string; level: { name: string } | null }[];
  courses: CourseRow[];
  roster: { id: string; name: string; phone: string | null }[];
  feeStructure: FeeStructure | null;
}

interface StudentOption {
  id: string;
  name: string;
}

export function UnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);

  function loadSessions() {
    api.get<ClassSession[]>(`/api/units/${id}/sessions`).then(setSessions);
  }

  function load() {
    api.get<UnitDetail>(`/api/structure/units/${id}`).then(setUnit);
    api.get<ScheduleSlot[]>(`/api/units/${id}/schedule`).then(setSlots);
    loadSessions();
  }

  useEffect(() => {
    load();
    api.get<StudentOption[]>("/api/students").then(setAllStudents);
  }, [id]);

  if (!unit) return null;

  const enrolledIds = new Set(unit.roster.map((s) => s.id));
  const notEnrolled = allStudents.filter((s) => !enrolledIds.has(s.id));

  return (
    <div>
      <p style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 2 }}>
        <Link to="/dashboard/structure">Structure</Link>
        {unit.ancestors.map((a) => (
          <span key={a.id}>
            {" › "}
            <Link to={`/dashboard/structure/${a.id}`}>{a.name}</Link>
          </span>
        ))}
      </p>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{unit.name}</h1>
      <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 28 }}>
        {unit.level?.name ?? "Group"} · {unit.roster.length} student{unit.roster.length === 1 ? "" : "s"}
      </p>

      {unit.children.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Inside this group</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {unit.children.map((child) => (
              <Link key={child.id} to={`/dashboard/structure/${child.id}`} className="btn btn-secondary">
                {child.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <CoursesSection unitId={unit.id} unitName={unit.name} courses={unit.courses} onChanged={load} />
      <RosterSection unitId={unit.id} roster={unit.roster} notEnrolled={notEnrolled} onChanged={load} />
      <ScheduleSection unitId={unit.id} slots={slots} courses={unit.courses} onChanged={load} />
      <SessionsSection unitId={unit.id} sessions={sessions} onChanged={loadSessions} />
      <FeeStructureSection unitId={unit.id} structure={unit.feeStructure} onChanged={load} />
    </div>
  );
}

function CoursesSection({
  unitId,
  unitName,
  courses,
  onChanged,
}: {
  unitId: string;
  unitName: string;
  courses: CourseRow[];
  onChanged: () => void;
}) {
  const [form, setForm] = useState({ name: "", teacherId: "", enrollmentMode: "ALL_IN_UNIT" });
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ id: string; name: string }[]>("/api/staff").then(setTeachers).catch(() => setTeachers([]));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/courses", {
        orgUnitId: unitId,
        name: form.name.trim(),
        teacherId: form.teacherId || undefined,
        enrollmentMode: form.enrollmentMode,
      });
      setForm({ name: "", teacherId: "", enrollmentMode: "ALL_IN_UNIT" });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add subject.");
    }
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Subjects</h2>
      <DataTable
        rows={courses}
        rowKey={(c) => c.id}
        emptyMessage="No subjects yet."
        columns={[
          {
            header: "Subject",
            render: (c) => (
              <>
                <Link to={`/dashboard/courses/${c.id}`}>{c.name}</Link>
                {c.inherited && (
                  <span style={{ fontSize: 11, marginLeft: 8, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                    from {c.orgUnit.name}
                  </span>
                )}
              </>
            ),
          },
          { header: "Teacher", render: (c) => c.teacher?.name ?? "—" },
          { header: "Taken by", render: (c) => (c.enrollmentMode === "SELECTED" ? "Selected students" : "Everyone") },
          {
            header: "",
            render: (c) =>
              c.inherited ? null : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 13, padding: 0 }}
                  onClick={() => api.delete(`/api/courses/${c.id}`).then(onChanged)}
                >
                  Remove
                </button>
              ),
          },
        ]}
      />
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
        <FormField label={`Add a subject to ${unitName}`}>
          <TextInput placeholder="e.g. Physics" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Teacher">
          <Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
            <option value="">Unassigned</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Taken by">
          <Select value={form.enrollmentMode} onChange={(e) => setForm({ ...form, enrollmentMode: e.target.value })}>
            <option value="ALL_IN_UNIT">Everyone in this group</option>
            <option value="SELECTED">Selected students (elective)</option>
          </Select>
        </FormField>
        <button type="submit" className="btn btn-primary" style={{ height: 36 }}>
          Add
        </button>
      </form>
      {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
    </section>
  );
}

function RosterSection({
  unitId,
  roster,
  notEnrolled,
  onChanged,
}: {
  unitId: string;
  roster: { id: string; name: string; phone: string | null }[];
  notEnrolled: StudentOption[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState("");

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await api.post(`/api/structure/units/${unitId}/enroll`, { studentId: selected });
    setSelected("");
    onChanged();
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Students</h2>
      <DataTable
        rows={roster}
        rowKey={(s) => s.id}
        emptyMessage="Nobody here yet."
        columns={[
          { header: "Name", render: (s) => <Link to={`/dashboard/students/${s.id}`}>{s.name}</Link> },
          { header: "Phone", render: (s) => s.phone ?? "—" },
          {
            header: "",
            render: (s) => (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 13, padding: 0 }}
                onClick={() => api.delete(`/api/structure/units/${unitId}/enroll/${s.id}`).then(onChanged)}
              >
                Remove
              </button>
            ),
          },
        ]}
      />
      {notEnrolled.length > 0 && (
        <form onSubmit={handleEnroll} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 14 }}>
          <FormField label="Add a student">
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

function ScheduleSection({
  unitId,
  slots,
  courses,
  onChanged,
}: {
  unitId: string;
  slots: ScheduleSlot[];
  courses: CourseRow[];
  onChanged: () => void;
}) {
  const [form, setForm] = useState({ dayOfWeek: "1", startTime: "16:00", endTime: "17:00", courseId: "" });
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/api/units/${unitId}/schedule`, {
        dayOfWeek: Number(form.dayOfWeek),
        startTime: form.startTime,
        endTime: form.endTime,
        courseId: form.courseId || undefined,
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
          { header: "Subject", render: (s) => s.course?.name ?? "Whole group" },
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
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
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
        <FormField label="Subject">
          <Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">Whole group (daily attendance)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <button type="submit" className="btn btn-primary" style={{ height: 36 }}>
          Add
        </button>
      </form>
      {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
    </section>
  );
}

function SessionsSection({ unitId, sessions, onChanged }: { unitId: string; sessions: ClassSession[]; onChanged: () => void }) {
  const [range, setRange] = useState({ fromDate: "", toDate: "" });
  const [busy, setBusy] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/units/${unitId}/sessions/generate`, range);
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
          { header: "Subject", render: (s) => s.course?.name ?? "Whole group" },
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

function FeeStructureSection({ unitId, structure, onChanged }: { unitId: string; structure: FeeStructure | null; onChanged: () => void }) {
  const [form, setForm] = useState({
    amount: structure?.amount ?? "",
    billingCycle: structure?.billingCycle ?? "MONTHLY",
  });
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/api/units/${unitId}/fee-structure`, { amount: Number(form.amount), billingCycle: form.billingCycle });
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
