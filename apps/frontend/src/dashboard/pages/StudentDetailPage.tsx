import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { formatDate, rupees } from "../../lib/format";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { FormField, Select, TextInput } from "../../components/FormField";
import { GroupSelect } from "../../components/GroupSelect";
import { PageHeader, SectionHeader } from "../../components/PageHeader";
import { useToast } from "../../components/ToastContext";
import { AttendanceTag, InvoiceStatusTag } from "../../components/StatusTag";
import { FeeSummaryStrip } from "../../components/FeeSummaryStrip";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

interface Payment {
  id: string;
  amount: string;
  method: string;
  paidAt: string;
}

type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

interface Invoice {
  id: string;
  amount: string;
  dueDate: string;
  status: InvoiceStatus;
  notes: string | null;
  payments: Payment[];
}

type ConsentStatus = "NOT_REQUIRED" | "PENDING" | "CONFIRMED" | "REVOKED";

interface StudentDetail {
  id: string;
  name: string;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  studentAccountId: string | null;
  consentStatus: ConsentStatus;
  // The API returns every enrolment, including dropped ones and ones in
  // archived groups, so the status/isActive flags are filtered client-side.
  enrollments: { status: "ACTIVE" | "DROPPED" | string; orgUnit: { id: string; name: string; isActive?: boolean } }[];
  courseEnrollments: { course: { id: string; name: string } }[];
  invoices: Invoice[];
}

interface AttendanceSummary {
  overall: { present: number; total: number; percent: number | null };
  subjects: { name: string; present: number; total: number; percent: number | null }[];
}

interface AttendanceRecord {
  id: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  classSession: {
    date: string;
    orgUnit: { id: string; name: string };
    course: { id: string; name: string } | null;
  };
}

interface AttendanceData {
  summary: AttendanceSummary;
  recent: { items: AttendanceRecord[]; total: number };
}

const ATTENDANCE_TAG: Record<AttendanceRecord["status"], { label: string; variant: string }> = {
  PRESENT: { label: "Present", variant: "tag-accent-2" },
  LATE: { label: "Late", variant: "tag-warning" },
  ABSENT: { label: "Absent", variant: "tag-danger" },
  EXCUSED: { label: "Excused", variant: "tag-neutral" },
};

const RECENT_SESSIONS = 20;

function paidOf(invoice: Invoice) {
  return invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
}

function AccessTag({ s }: { s: StudentDetail }) {
  if (!s.studentAccountId) return <span className="tag tag-neutral">No portal access</span>;
  if (s.consentStatus === "PENDING") return <span className="tag tag-warning">Waiting for guardian</span>;
  if (s.consentStatus === "REVOKED") return <span className="tag tag-danger">Consent withdrawn</span>;
  return <span className="tag tag-accent-2">Active</span>;
}

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { identity } = useAuth();
  const showToast = useToast();
  const role = identity?.kind === "STAFF" ? identity.role : null;
  const isOwner = role === "OWNER";
  const canSeeFees = role === "OWNER" || role === "ACCOUNTANT";
  // Accountants have no attendance role — the API refuses them.
  const canSeeAttendance = role === "OWNER" || role === "TEACHER";

  const { data: student, loading, error, reload } = useApiData<StudentDetail>(() => api.get<StudentDetail>(`/api/students/${id}`), [id]);
  const attendance = useApiData<AttendanceData | null>(async () => {
    if (!canSeeAttendance) return null;
    const [summary, recent] = await Promise.all([
      api.get<AttendanceSummary>(`/api/students/${id}/attendance-summary`),
      api.get<{ items: AttendanceRecord[]; total: number }>(`/api/students/${id}/attendance?take=${RECENT_SESSIONS}`),
    ]);
    return { summary, recent };
  }, [id, canSeeAttendance]);
  useDocumentTitle(student?.name ?? "Student");

  const [showEdit, setShowEdit] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [unenrolTarget, setUnenrolTarget] = useState<{ id: string; name: string } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function resendConsent(s: StudentDetail) {
    setActionBusy(true);
    try {
      await api.post(`/api/students/${s.id}/resend-consent`);
      showToast(`New code sent to ${s.guardianName ?? "the guardian"} (${s.guardianEmail}).`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not resend the code.", "error");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmCancelInvoice() {
    if (!cancelTarget) return;
    setActionBusy(true);
    try {
      await api.post(`/api/invoices/${cancelTarget.id}/cancel`);
      setCancelTarget(null);
      reload();
      showToast("Invoice cancelled.");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not cancel the invoice.", "error");
      setCancelTarget(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmUnenrol(studentId: string) {
    if (!unenrolTarget) return;
    setActionBusy(true);
    try {
      await api.delete(`/api/structure/units/${unenrolTarget.id}/enroll/${studentId}`);
      const name = unenrolTarget.name;
      setUnenrolTarget(null);
      reload();
      showToast(`Removed from ${name}.`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not remove from the group.", "error");
      setUnenrolTarget(null);
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <AsyncState loading={loading} error={error} data={student} onRetry={reload} backTo="/dashboard/students" backLabel="Back to students">
      {(student) => {
        const groups = student.enrollments.filter((e) => e.status === "ACTIVE" && e.orgUnit.isActive !== false);
        const invoices = student.invoices.filter((i) => i.status !== "CANCELLED");
        const cancelled = student.invoices.filter((i) => i.status === "CANCELLED");
        const waitingOnGuardian =
          Boolean(student.studentAccountId) && Boolean(student.guardianEmail) && (student.consentStatus === "PENDING" || student.consentStatus === "REVOKED");

        return (
          <div>
            <PageHeader
              breadcrumbs={[{ label: "Students", to: "/dashboard/students" }, { label: student.name }]}
              title={student.name}
              subtitle={
                <>
                  {groups.map((e) => e.orgUnit.name).join(", ") || "Not in a group yet"} ·{" "}
                  {student.phone ? <a href={`tel:${student.phone}`}>{student.phone}</a> : "No phone on file"}
                </>
              }
              actions={
                isOwner && (
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(true)}>
                    Edit details
                  </button>
                )
              }
            />

            <div className="sd-grid">
              <section className="card card-md elev-sm" aria-labelledby="guardian-heading">
                <h2 className="section-title" id="guardian-heading" style={{ marginBottom: 4 }}>
                  Guardian contact
                </h2>
                {student.guardianName || student.guardianPhone || student.guardianEmail ? (
                  <dl className="sd-dl">
                    <dt>Name</dt>
                    <dd>{student.guardianName ?? "—"}</dd>
                    <dt>Phone</dt>
                    <dd>{student.guardianPhone ? <a href={`tel:${student.guardianPhone}`}>{student.guardianPhone}</a> : "—"}</dd>
                    <dt>Email</dt>
                    <dd>{student.guardianEmail ? <a href={`mailto:${student.guardianEmail}`}>{student.guardianEmail}</a> : "—"}</dd>
                  </dl>
                ) : (
                  <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
                    No guardian details on file.
                    {isOwner && " Add them with Edit details."}
                  </p>
                )}
              </section>

              <section className="card card-md elev-sm" aria-labelledby="access-heading">
                <h2 className="section-title" id="access-heading" style={{ marginBottom: 4 }}>
                  Portal access
                </h2>
                <div>
                  <AccessTag s={student} />
                </div>
                {!student.studentAccountId && (
                  <p className="text-muted" style={{ margin: 0, fontSize: 13.5 }}>
                    Invite {student.name.split(" ")[0]} to see their timetable, attendance and fees in the student portal.
                  </p>
                )}
                {waitingOnGuardian && (
                  <p className="text-muted" style={{ margin: 0, fontSize: 13.5 }}>
                    {student.consentStatus === "REVOKED" ? "The guardian withdrew consent." : "Waiting for"} {student.guardianName ?? "the guardian"} (
                    {student.guardianEmail}) to confirm with the emailed code. Codes expire, so you can send a new one.
                  </p>
                )}
                {isOwner && !student.studentAccountId && (
                  <div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowInvite(true)}>
                      Invite to portal
                    </button>
                  </div>
                )}
                {isOwner && waitingOnGuardian && (
                  <div>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={actionBusy} onClick={() => resendConsent(student)}>
                      Resend consent code
                    </button>
                  </div>
                )}
              </section>
            </div>

            <section aria-labelledby="groups-heading">
              <SectionHeader title={<span id="groups-heading">Groups</span>} />
              <DataTable
                caption={`Groups ${student.name} is in`}
                rows={groups}
                rowKey={(e) => e.orgUnit.id}
                emptyMessage="Not in any group yet."
                columns={[
                  {
                    header: "Group",
                    primary: true,
                    render: (e) => <Link to={`/dashboard/structure/${e.orgUnit.id}`}>{e.orgUnit.name}</Link>,
                  },
                  ...(isOwner
                    ? [
                        {
                          header: "",
                          srHeader: "Actions",
                          render: (e: { orgUnit: { id: string; name: string } }) => (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-ghost-danger"
                              aria-label={`Remove ${student.name} from ${e.orgUnit.name}`}
                              onClick={() => setUnenrolTarget(e.orgUnit)}
                            >
                              Remove
                            </button>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
              {isOwner && <EnrolForm studentId={student.id} currentGroupIds={groups.map((g) => g.orgUnit.id)} onEnrolled={reload} />}
            </section>

            {student.courseEnrollments.length > 0 && (
              <section className="sd-section" aria-labelledby="electives-heading">
                <SectionHeader title={<span id="electives-heading">Electives</span>} />
                <DataTable
                  caption={`Electives ${student.name} takes`}
                  rows={student.courseEnrollments}
                  rowKey={(c) => c.course.id}
                  columns={[
                    {
                      header: "Subject",
                      primary: true,
                      render: (c) => <Link to={`/dashboard/courses/${c.course.id}`}>{c.course.name}</Link>,
                    },
                  ]}
                />
              </section>
            )}

            {canSeeAttendance && (
              <section className="sd-section" aria-labelledby="attendance-heading">
                <SectionHeader title={<span id="attendance-heading">Attendance</span>} />
                {attendance.error ? (
                  <div className="banner banner-warning" role="alert">
                    <span>{attendance.error}</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={attendance.reload}>
                      Try again
                    </button>
                  </div>
                ) : attendance.data ? (
                  <AttendanceSection data={attendance.data} />
                ) : (
                  <div aria-busy="true" aria-label="Loading attendance">
                    <div className="skeleton-line" style={{ width: "40%" }} />
                  </div>
                )}
              </section>
            )}

            {canSeeFees && (
              <section className="sd-section" aria-labelledby="fees-heading">
                <SectionHeader
                  title={<span id="fees-heading">Fees</span>}
                  actions={
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowInvoice(true)}>
                      New invoice
                    </button>
                  }
                />
                <FeeSummaryStrip invoices={invoices} />
                <DataTable
                  caption={`Invoices for ${student.name}`}
                  rows={invoices}
                  rowKey={(i) => i.id}
                  emptyMessage="No invoices yet."
                  columns={[
                    { header: "Due", primary: true, sortValue: (i) => i.dueDate, render: (i) => formatDate(i.dueDate) },
                    { header: "Amount", render: (i) => rupees(i.amount) },
                    { header: "Paid", render: (i) => rupees(paidOf(i)) },
                    { header: "Status", render: (i) => <InvoiceStatusTag status={i.status} /> },
                    {
                      header: "",
                      srHeader: "Actions",
                      render: (i) => {
                        const due = formatDate(i.dueDate);
                        return (
                          <div className="row" style={{ gap: 2, flexWrap: "nowrap" }}>
                            {i.status !== "PAID" && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                aria-label={`Record payment for the invoice due ${due}`}
                                onClick={() => setPayTarget(i)}
                              >
                                Record payment
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-label={`Edit the invoice due ${due}`}
                              onClick={() => setEditTarget(i)}
                            >
                              Edit
                            </button>
                            {i.payments.length === 0 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-ghost-danger"
                                aria-label={`Cancel the invoice due ${due}`}
                                onClick={() => setCancelTarget(i)}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        );
                      },
                    },
                  ]}
                />
                {cancelled.length > 0 && (
                  <p className="sd-help">
                    {cancelled.length} cancelled invoice{cancelled.length === 1 ? "" : "s"} not shown.
                  </p>
                )}
              </section>
            )}

            {showEdit && <EditStudentModal student={student} onClose={() => setShowEdit(false)} onSaved={reload} />}
            {showInvite && <InviteStudentModal student={student} onClose={() => setShowInvite(false)} onInvited={reload} />}
            {showInvoice && (
              <NewInvoiceModal
                studentId={student.id}
                units={groups.map((e) => e.orgUnit)}
                onClose={() => setShowInvoice(false)}
                onCreated={reload}
              />
            )}
            {payTarget && <RecordPaymentModal invoice={payTarget} onClose={() => setPayTarget(null)} onRecorded={reload} />}
            {editTarget && <EditInvoiceModal invoice={editTarget} onClose={() => setEditTarget(null)} onSaved={reload} />}
            {cancelTarget && (
              <ConfirmModal
                title="Cancel this invoice?"
                confirmLabel="Cancel invoice"
                variant="danger"
                busy={actionBusy}
                onClose={() => setCancelTarget(null)}
                onConfirm={confirmCancelInvoice}
                body={`The ${rupees(cancelTarget.amount)} invoice due ${formatDate(cancelTarget.dueDate)} will be voided and stop counting as owed. This can't be undone.`}
              />
            )}
            {unenrolTarget && (
              <ConfirmModal
                title={`Remove from ${unenrolTarget.name}?`}
                confirmLabel="Remove"
                variant="danger"
                busy={actionBusy}
                onClose={() => setUnenrolTarget(null)}
                onConfirm={() => confirmUnenrol(student.id)}
                body={`${student.name} will no longer appear on ${unenrolTarget.name}'s roster or its attendance sheets. Past attendance is kept.`}
              />
            )}
          </div>
        );
      }}
    </AsyncState>
  );
}

function AttendanceSection({ data }: { data: AttendanceData }) {
  const { summary, recent } = data;
  const { overall } = summary;

  if (overall.total === 0) {
    return <p className="text-muted" style={{ margin: 0 }}>No attendance has been marked for this student yet.</p>;
  }

  return (
    <div className="stack-lg">
      <div className="row">
        {overall.percent !== null && <AttendanceTag pct={overall.percent} />}
        <span className="text-muted" style={{ fontSize: 13.5 }}>
          Present or late in {overall.present} of {overall.total} sessions. Late counts as present.
        </span>
      </div>

      {summary.subjects.length > 0 && (
        <DataTable
          caption="Attendance by subject"
          rows={summary.subjects}
          rowKey={(s) => s.name}
          columns={[
            { header: "Subject", primary: true, sortValue: (s) => s.name, render: (s) => s.name },
            { header: "Attended", render: (s) => `${s.present} of ${s.total}` },
            { header: "Rate", sortValue: (s) => s.percent ?? -1, render: (s) => (s.percent === null ? "—" : <AttendanceTag pct={s.percent} />) },
          ]}
        />
      )}

      {recent.items.length > 0 && (
        <div>
          <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>
            Last {recent.items.length} session{recent.items.length === 1 ? "" : "s"}
          </h3>
          <DataTable
            caption="Recent attendance"
            rows={recent.items}
            rowKey={(r) => r.id}
            columns={[
              { header: "Date", primary: true, render: (r) => formatDate(r.classSession.date, { weekday: "short", day: "numeric", month: "short" }) },
              { header: "Subject", render: (r) => r.classSession.course?.name ?? "Whole group" },
              { header: "Group", render: (r) => r.classSession.orgUnit.name },
              {
                header: "Status",
                render: (r) => <span className={`tag ${ATTENDANCE_TAG[r.status].variant}`}>{ATTENDANCE_TAG[r.status].label}</span>,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function EnrolForm({ studentId, currentGroupIds, onEnrolled }: { studentId: string; currentGroupIds: string[]; onEnrolled: () => void }) {
  const showToast = useToast();
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const already = groupId !== "" && currentGroupIds.includes(groupId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId || already) return;
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/structure/units/${groupId}/enroll`, { studentId });
      setGroupId("");
      onEnrolled();
      showToast("Added to group.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add to the group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="inline-form">
      <div style={{ flex: "1 1 240px", maxWidth: 360 }}>
        <FormField label="Add to a group">
          <GroupSelect value={groupId} onChange={setGroupId} emptyLabel="Choose a group…" />
        </FormField>
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={!groupId || already || busy}>
        {busy ? "Adding…" : "Add to group"}
      </button>
      {already && <p className="form-error" role="alert" style={{ margin: 0 }}>Already in that group.</p>}
      {error && <p className="form-error" role="alert" style={{ margin: 0 }}>{error}</p>}
    </form>
  );
}

function EditStudentModal({ student, onClose, onSaved }: { student: StudentDetail; onClose: () => void; onSaved: () => void }) {
  const showToast = useToast();
  const [form, setForm] = useState({
    name: student.name,
    phone: student.phone ?? "",
    guardianName: student.guardianName ?? "",
    guardianPhone: student.guardianPhone ?? "",
    guardianEmail: student.guardianEmail ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.patch(`/api/students/${student.id}`, form);
      onSaved();
      onClose();
      showToast("Details saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Edit student"
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="edit-student" className="btn btn-primary" disabled={busy || !form.name.trim()}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      }
    >
      <form id="edit-student" onSubmit={handleSubmit}>
        <FormField label="Name" required error={fields.name}>
          <TextInput required autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Phone" error={fields.phone}>
          <TextInput type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </FormField>
        <FormField label="Guardian name" error={fields.guardianName}>
          <TextInput value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
        </FormField>
        <FormField label="Guardian phone" error={fields.guardianPhone}>
          <TextInput type="tel" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
        </FormField>
        <FormField label="Guardian email" error={fields.guardianEmail}>
          <TextInput type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} />
        </FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

function InviteStudentModal({ student, onClose, onInvited }: { student: StudentDetail; onClose: () => void; onInvited: () => void }) {
  const showToast = useToast();
  const [email, setEmail] = useState("");
  const [guardianEmail, setGuardianEmail] = useState(student.guardianEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.post(`/api/students/${student.id}/invite`, {
        email: email.trim().toLowerCase(),
        ...(guardianEmail.trim() ? { guardianEmail: guardianEmail.trim().toLowerCase() } : {}),
      });
      onInvited();
      onClose();
      showToast(`Invite sent to ${email.trim()}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send invite.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Invite ${student.name}`}
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="invite-student" className="btn btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send invite"}
        </button>
      }
    >
      <form id="invite-student" onSubmit={handleSubmit}>
        <FormField label="Student's email" required error={fields.email}>
          <TextInput type="email" required autoFocus autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Guardian's email (optional — they must confirm before access activates)" error={fields.guardianEmail}>
          <TextInput type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
        </FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

function NewInvoiceModal({
  studentId,
  units,
  onClose,
  onCreated,
}: {
  studentId: string;
  units: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const showToast = useToast();
  const [form, setForm] = useState({ orgUnitId: units[0]?.id ?? "", amount: "", dueDate: "" });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.post(`/api/students/${studentId}/invoices`, {
        orgUnitId: form.orgUnitId || undefined,
        amount: Number(form.amount),
        dueDate: form.dueDate,
      });
      onCreated();
      onClose();
      showToast("Invoice created.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create invoice.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New invoice"
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="new-invoice" className="btn btn-primary" disabled={busy}>
          {busy ? "Creating…" : "Create invoice"}
        </button>
      }
    >
      <form id="new-invoice" onSubmit={handleSubmit}>
        {units.length > 0 && (
          <FormField label="Group">
            <Select value={form.orgUnitId} onChange={(e) => setForm({ ...form, orgUnitId: e.target.value })}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Amount (₹)" required error={fields.amount}>
          <TextInput type="number" min="0" step="0.01" required autoFocus value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </FormField>
        <FormField label="Due date" required error={fields.dueDate}>
          <TextInput type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

function EditInvoiceModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const showToast = useToast();
  const paid = paidOf(invoice);
  const [form, setForm] = useState({
    amount: String(Number(invoice.amount)),
    dueDate: invoice.dueDate.slice(0, 10),
    notes: invoice.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.patch(`/api/invoices/${invoice.id}`, {
        amount: Number(form.amount),
        dueDate: form.dueDate,
        notes: form.notes.trim() === "" ? null : form.notes.trim(),
      });
      onSaved();
      onClose();
      showToast("Invoice updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the invoice.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Edit invoice"
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="edit-invoice" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      }
    >
      <form id="edit-invoice" onSubmit={handleSubmit}>
        {paid > 0 && <p className="text-muted" style={{ marginTop: 0, fontSize: 13 }}>{rupees(paid)} has already been paid, so the amount can't go below that.</p>}
        <FormField label="Amount (₹)" required error={fields.amount}>
          <TextInput
            type="number"
            min={paid > 0 ? paid : "0"}
            step="0.01"
            required
            autoFocus
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </FormField>
        <FormField label="Due date" required error={fields.dueDate}>
          <TextInput type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </FormField>
        <FormField label="Notes (optional)" error={fields.notes}>
          <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

function RecordPaymentModal({ invoice, onClose, onRecorded }: { invoice: Invoice; onClose: () => void; onRecorded: () => void }) {
  const remaining = Number(invoice.amount) - paidOf(invoice);
  const showToast = useToast();
  const [form, setForm] = useState({ amount: remaining.toFixed(2), method: "CASH" });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.post(`/api/invoices/${invoice.id}/payments`, { amount: Number(form.amount), method: form.method });
      onRecorded();
      onClose();
      showToast(`Payment of ${rupees(form.amount)} recorded.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record payment.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Record payment"
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="record-payment" className="btn btn-primary" disabled={busy}>
          {busy ? "Recording…" : "Record payment"}
        </button>
      }
    >
      <form id="record-payment" onSubmit={handleSubmit}>
        <p className="text-muted" style={{ marginTop: 0, fontSize: 13 }}>
          {rupees(remaining)} remaining of {rupees(invoice.amount)}, due {formatDate(invoice.dueDate)}
        </p>
        <FormField label="Amount (₹)" required error={fields.amount}>
          <TextInput
            type="number"
            min="0"
            max={remaining}
            step="0.01"
            required
            autoFocus
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </FormField>
        <FormField label="Method">
          <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </Select>
        </FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
