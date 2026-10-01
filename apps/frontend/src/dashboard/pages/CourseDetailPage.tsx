import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { WEEKDAYS, formatTimeRange } from "../../lib/format";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Modal } from "../../components/Modal";
import { FormField, Select, TextInput } from "../../components/FormField";
import { PageHeader, SectionHeader } from "../../components/PageHeader";
import { useToast } from "../../components/ToastContext";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

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
  const [showEdit, setShowEdit] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  const { data, loading, error: loadError, reload } = useApiData<CoursePageData>(async () => {
    const course = await api.get<CourseDetail>(`/api/courses/${id}`);
    // Electives are picked from the group that studies the subject.
    let candidates: { id: string; name: string }[] = [];
    if (course.enrollmentMode === "SELECTED" && isOwner) {
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

  async function handleRemoveConfirmed() {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/courses/${id}/enroll/${removeTarget.id}`);
      showToast(`${removeTarget.name} removed.`);
      setRemoveTarget(null);
      reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not remove student.", "error");
      setRemoveTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AsyncState loading={loading} error={loadError} data={data} onRetry={reload} backTo="/dashboard/courses" backLabel="Back to subjects">
      {({ course, candidates }) => {
        const isElective = course.enrollmentMode === "SELECTED";

        return (
          <div>
            <PageHeader
              breadcrumbs={[
                { label: "Subjects", to: "/dashboard/courses" },
                { label: course.orgUnit.name, to: `/dashboard/structure/${course.orgUnit.id}` },
                { label: course.name },
              ]}
              title={course.name}
              subtitle={
                <>
                  {course.teacher ? `Taught by ${course.teacher.name}` : "No teacher assigned"} ·{" "}
                  {isElective ? "Elective — selected students only" : "Taught to everyone in "}
                  {!isElective && <Link to={`/dashboard/structure/${course.orgUnit.id}`}>{course.orgUnit.name}</Link>}
                </>
              }
              actions={
                isOwner && (
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(true)}>
                    Edit subject
                  </button>
                )
              }
            />

            <section style={{ marginBottom: 32 }} aria-labelledby="schedule-heading">
              <SectionHeader title={<span id="schedule-heading">Weekly schedule</span>} />
              {course.scheduleSlots.length === 0 ? (
                <EmptyState
                  title="Not timetabled yet."
                  action={
                    isOwner && (
                      <Link to={`/dashboard/structure/${course.orgUnit.id}`} className="btn btn-secondary btn-sm">
                        Add a slot on {course.orgUnit.name}
                      </Link>
                    )
                  }
                />
              ) : (
                <DataTable
                  caption={`Weekly schedule for ${course.name}`}
                  rows={course.scheduleSlots}
                  rowKey={(s) => s.id}
                  columns={[
                    { header: "Day", primary: true, render: (s) => WEEKDAYS[s.dayOfWeek] },
                    { header: "Time", render: (s) => formatTimeRange(s.startTime, s.endTime) },
                  ]}
                />
              )}
            </section>

            <section aria-labelledby="students-heading">
              <SectionHeader
                title={<span id="students-heading">Students taking this ({course.roster.length})</span>}
              />
              {course.roster.length === 0 ? (
                <EmptyState
                  title={isElective ? "Nobody has opted in yet." : `Nobody in ${course.orgUnit.name} yet.`}
                  action={
                    isOwner && !isElective ? (
                      <Link to={`/dashboard/structure/${course.orgUnit.id}`} className="btn btn-secondary btn-sm">
                        Add students to {course.orgUnit.name}
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <DataTable
                  caption={`Students taking ${course.name}`}
                  rows={course.roster}
                  rowKey={(s) => s.id}
                  columns={[
                    {
                      header: "Name",
                      primary: true,
                      sortValue: (s) => s.name,
                      render: (s) => <Link to={`/dashboard/students/${s.id}`}>{s.name}</Link>,
                    },
                    { header: "Phone", render: (s) => (s.phone ? <a href={`tel:${s.phone}`}>{s.phone}</a> : "—") },
                    ...(isElective && isOwner
                      ? [
                          {
                            header: "",
                            srHeader: "Actions",
                            render: (s: { id: string; name: string }) => (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-ghost-danger"
                                aria-label={`Remove ${s.name} from ${course.name}`}
                                onClick={() => setRemoveTarget(s)}
                              >
                                Remove
                              </button>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              )}

              {isElective && isOwner && (
                <form onSubmit={handleAdd} className="inline-form">
                  <FormField label="Add a student to this elective">
                    <Select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={candidates.length === 0}>
                      <option value="">{candidates.length === 0 ? `Everyone in ${course.orgUnit.name} has opted in` : "Choose…"}</option>
                      {candidates.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!selected || busy}>
                    {busy ? "Adding…" : "Add"}
                  </button>
                </form>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
            </section>

            {showEdit && <EditCourseModal course={course} onClose={() => setShowEdit(false)} onSaved={reload} />}
            {removeTarget && (
              <ConfirmModal
                title={`Remove ${removeTarget.name}?`}
                confirmLabel="Remove"
                variant="danger"
                busy={busy}
                onClose={() => setRemoveTarget(null)}
                onConfirm={handleRemoveConfirmed}
                body={`${removeTarget.name} will no longer be on ${course.name}'s roster or its attendance sheets. You can add them back later.`}
              />
            )}
          </div>
        );
      }}
    </AsyncState>
  );
}

interface StaffMember {
  id: string;
  name: string;
  role: "OWNER" | "TEACHER" | "ACCOUNTANT";
  isActive: boolean;
}

function EditCourseModal({ course, onClose, onSaved }: { course: CourseDetail; onClose: () => void; onSaved: () => void }) {
  const showToast = useToast();
  const [name, setName] = useState(course.name);
  const [teacherId, setTeacherId] = useState(course.teacher?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const { data: staff } = useApiData<StaffMember[]>(() => api.get<StaffMember[]>("/api/staff"));
  // Teachers only — but never hide the current assignee, even if their role
  // or status has since changed, or the select would show a blank value.
  const teachers = (staff ?? []).filter((s) => (s.role === "TEACHER" && s.isActive) || s.id === course.teacher?.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.patch(`/api/courses/${course.id}`, {
        name: name.trim(),
        // An empty choice unassigns the teacher.
        teacherId: teacherId || null,
      });
      onSaved();
      onClose();
      showToast("Subject updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Edit subject"
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="edit-course" className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      }
    >
      <form id="edit-course" onSubmit={handleSubmit}>
        <FormField label="Subject name" required error={fields.name}>
          <TextInput required autoFocus autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Teacher" error={fields.teacherId}>
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            {!course.teacher && <option value="">No teacher assigned</option>}
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
        {staff && teachers.length === 0 && (
          <p className="sd-help" style={{ marginTop: -6 }}>
            No teachers yet. <Link to="/dashboard/staff">Add a teacher</Link> first.
          </p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
