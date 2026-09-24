import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { DataTable } from "../../components/DataTable";
import { FormField, Select } from "../../components/FormField";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface CourseDetail {
  id: string;
  name: string;
  code: string | null;
  enrollmentMode: "ALL_IN_UNIT" | "SELECTED";
  teacher: { id: string; name: string } | null;
  orgUnit: { id: string; name: string };
  scheduleSlots: { id: string; dayOfWeek: number; startTime: string; endTime: string }[];
  roster: { id: string; name: string; phone: string | null }[];
}

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<CourseDetail>(`/api/courses/${id}`).then(async (detail) => {
      setCourse(detail);
      // Electives are picked from the group that studies the subject.
      if (detail.enrollmentMode === "SELECTED") {
        const inGroup = await api.get<{ id: string; name: string }[]>(
          `/api/students?orgUnitId=${detail.orgUnit.id}`
        );
        const taking = new Set(detail.roster.map((s) => s.id));
        setCandidates(inGroup.filter((s) => !taking.has(s.id)));
      }
    });
  }

  useEffect(load, [id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    try {
      await api.post(`/api/courses/${id}/enroll`, { studentId: selected });
      setSelected("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add student.");
    }
  }

  if (!course) return null;

  const isElective = course.enrollmentMode === "SELECTED";

  return (
    <div>
      <p style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 2 }}>
        <Link to="/dashboard/courses">Subjects</Link>
        {" › "}
        <Link to={`/dashboard/structure/${course.orgUnit.id}`}>{course.orgUnit.name}</Link>
      </p>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{course.name}</h1>
      <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 28 }}>
        {course.teacher?.name ?? "No teacher assigned"} ·{" "}
        {isElective ? "Elective — selected students only" : `Taught to everyone in ${course.orgUnit.name}`}
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Weekly schedule</h2>
        <DataTable
          rows={course.scheduleSlots}
          rowKey={(s) => s.id}
          emptyMessage="Not timetabled yet — add a slot from the group's page."
          columns={[
            { header: "Day", render: (s) => DAYS[s.dayOfWeek] },
            { header: "Time", render: (s) => `${s.startTime} – ${s.endTime}` },
          ]}
        />
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Students taking this</h2>
        <DataTable
          rows={course.roster}
          rowKey={(s) => s.id}
          emptyMessage={isElective ? "Nobody has opted in yet." : "Nobody in this group yet."}
          columns={[
            { header: "Name", render: (s) => <Link to={`/dashboard/students/${s.id}`}>{s.name}</Link> },
            { header: "Phone", render: (s) => s.phone ?? "—" },
            ...(isElective
              ? [
                  {
                    header: "",
                    render: (s: { id: string }) => (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: 13, padding: 0 }}
                        onClick={() => api.delete(`/api/courses/${course.id}/enroll/${s.id}`).then(load)}
                      >
                        Remove
                      </button>
                    ),
                  },
                ]
              : []),
          ]}
        />

        {isElective && candidates.length > 0 && (
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 14 }}>
            <FormField label="Add a student to this elective">
              <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">Choose…</option>
                {candidates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <button type="submit" className="btn btn-primary" style={{ height: 36 }} disabled={!selected}>
              Add
            </button>
          </form>
        )}
        {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
      </section>
    </div>
  );
}
