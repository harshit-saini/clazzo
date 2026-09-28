import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";
import { FormField, Select } from "../../components/FormField";
import { useToast } from "../../components/ToastContext";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

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

interface CoursePageData {
  course: CourseDetail;
  candidates: { id: string; name: string }[];
}

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { identity } = useAuth();
  const isOwner = identity?.kind === "STAFF" && identity.role === "OWNER";
  const showToast = useToast();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error: loadError, reload } = useApiData<CoursePageData>(async () => {
    const course = await api.get<CourseDetail>(`/api/courses/${id}`);
    // Electives are picked from the group that studies the subject.
    let candidates: { id: string; name: string }[] = [];
    if (course.enrollmentMode === "SELECTED") {
      const inGroup = await api.get<{ items: { id: string; name: string }[] }>(
        `/api/students?orgUnitId=${course.orgUnit.id}&take=500`
      );
      const taking = new Set(course.roster.map((s) => s.id));
      candidates = inGroup.items.filter((s) => !taking.has(s.id));
    }
    return { course, candidates };
  }, [id]);
  useDocumentTitle(data?.course.name ?? "Subject");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/courses/${id}/enroll`, { studentId: selected });
      setSelected("");
      reload();
      showToast("Student added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add student.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(studentId: string, name: string) {
    try {
      await api.delete(`/api/courses/${id}/enroll/${studentId}`);
      reload();
      showToast(`${name} removed.`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not remove student.", "error");
    }
  }

  return (
    <AsyncState loading={loading} error={loadError} data={data} onRetry={reload} backTo="/dashboard/courses" backLabel="Back to subjects">
      {({ course, candidates }) => {
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
                  ...(isElective && isOwner
                    ? [
                        {
                          header: "",
                          render: (s: { id: string; name: string }) => (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ fontSize: 13 }}
                              onClick={() => handleRemove(s.id, s.name)}
                            >
                              Remove
                            </button>
                          ),
                        },
                      ]
                    : []),
                ]}
              />

              {isElective && isOwner && candidates.length > 0 && (
                <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
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
                  <button type="submit" className="btn btn-primary" style={{ height: 36 }} disabled={!selected || busy}>
                    {busy ? "Adding…" : "Add"}
                  </button>
                </form>
              )}
              {error && <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}
            </section>
          </div>
        );
      }}
    </AsyncState>
  );
}
