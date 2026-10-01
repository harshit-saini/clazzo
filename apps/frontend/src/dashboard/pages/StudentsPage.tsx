import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { parseStudentRows } from "../../lib/csv";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { FormField, TextInput } from "../../components/FormField";
import { GroupSelect } from "../../components/GroupSelect";
import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../components/ToastContext";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { UploadIcon } from "../../icons";

const PAGE_SIZE = 50;

type ConsentStatus = "NOT_REQUIRED" | "PENDING" | "CONFIRMED" | "REVOKED";

interface Student {
  id: string;
  name: string;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  studentAccountId: string | null;
  consentStatus: ConsentStatus;
  enrollments: { orgUnit: { id: string; name: string; depth: number } }[];
}

interface StudentPage {
  items: Student[];
  total: number;
}

function AccessTag({ s }: { s: Student }) {
  if (!s.studentAccountId) return <span className="tag tag-neutral">No portal access</span>;
  if (s.consentStatus === "PENDING") return <span className="tag tag-warning">Waiting for guardian</span>;
  if (s.consentStatus === "REVOKED") return <span className="tag tag-danger">Consent withdrawn</span>;
  return <span className="tag tag-accent-2">Active</span>;
}

export function StudentsPage() {
  useDocumentTitle("Students");
  const { identity } = useAuth();
  const showToast = useToast();
  const isOwner = identity?.kind === "STAFF" && identity.role === "OWNER";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<Student | null>(null);

  // Debounce so fast typing doesn't fire a request per keystroke, and reset
  // to page 1 whenever the search term actually changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, error, reload } = useApiData<StudentPage>(() => {
    const params = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(page * PAGE_SIZE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (groupId) params.set("orgUnitId", groupId);
    return api.get<StudentPage>(`/api/students?${params}`);
  }, [debouncedSearch, groupId, page]);

  async function resendConsent(s: Student) {
    try {
      await api.post(`/api/students/${s.id}/resend-consent`);
      showToast(`New code sent to ${s.guardianName ?? "the guardian"} (${s.guardianEmail}).`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not resend the code.", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Students"
        actions={
          isOwner && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowImport(true)}>
                <UploadIcon size={15} /> Import
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
                Add student
              </button>
            </>
          )
        }
      />

      <div className="row" style={{ marginBottom: 16 }}>
        <div style={{ flex: "1 1 260px", maxWidth: 360 }}>
          <TextInput
            type="search"
            aria-label="Search students"
            placeholder="Search name, phone or guardian…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 200px", maxWidth: 280 }}>
          <GroupSelect
            aria-label="Filter by group"
            value={groupId}
            onChange={(id) => {
              setGroupId(id);
              setPage(0);
            }}
            emptyLabel="All groups"
          />
        </div>
      </div>

      <AsyncState loading={loading} error={error} data={data} onRetry={reload}>
        {(page_) => (
          <>
            <DataTable
              caption="Students"
              rows={page_.items}
              rowKey={(s) => s.id}
              emptyMessage={
                debouncedSearch || groupId ? "No students match that search." : "No students yet. Add one, or import a list."
              }
              columns={[
                {
                  header: "Name",
                  primary: true,
                  sortValue: (s) => s.name,
                  render: (s) => <Link to={`/dashboard/students/${s.id}`}>{s.name}</Link>,
                },
                { header: "Groups", render: (s) => s.enrollments.map((e) => e.orgUnit.name).join(", ") || "—" },
                {
                  header: "Guardian",
                  render: (s) =>
                    s.guardianName || s.guardianPhone ? (
                      <>
                        {s.guardianName}
                        {s.guardianPhone && (
                          <>
                            {s.guardianName ? " · " : ""}
                            <a href={`tel:${s.guardianPhone}`}>{s.guardianPhone}</a>
                          </>
                        )}
                      </>
                    ) : (
                      "—"
                    ),
                },
                { header: "Portal access", render: (s) => <AccessTag s={s} /> },
                {
                  header: "",
                  srHeader: "Actions",
                  render: (s) => {
                    if (!isOwner) return null;
                    if (!s.studentAccountId)
                      return (
                        <button type="button" className="btn btn-ghost" aria-label={`Invite ${s.name}`} onClick={() => setInviteTarget(s)}>
                          Invite
                        </button>
                      );
                    if (s.guardianEmail && (s.consentStatus === "PENDING" || s.consentStatus === "REVOKED"))
                      return (
                        <button type="button" className="btn btn-ghost" aria-label={`Resend guardian code for ${s.name}`} onClick={() => resendConsent(s)}>
                          Resend code
                        </button>
                      );
                    return null;
                  },
                },
              ]}
            />
            {page_.total > PAGE_SIZE && (
              <div className="row-between" style={{ marginTop: 14, fontSize: 13 }}>
                <span aria-live="polite" style={{ color: "var(--color-text-muted)" }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, page_.total)} of {page_.total}
                </span>
                <div className="row">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={(page + 1) * PAGE_SIZE >= page_.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </AsyncState>

      {showAdd && <AddStudentModal defaultGroupId={groupId} onClose={() => setShowAdd(false)} onCreated={reload} />}
      {showImport && <ImportStudentsModal defaultGroupId={groupId} onClose={() => setShowImport(false)} onImported={reload} />}
      {inviteTarget && <InviteStudentModal student={inviteTarget} onClose={() => setInviteTarget(null)} onInvited={reload} />}
    </div>
  );
}

const EMPTY_FORM = { name: "", phone: "", guardianName: "", guardianPhone: "", guardianEmail: "" };

function AddStudentModal({
  defaultGroupId,
  onClose,
  onCreated,
}: {
  defaultGroupId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const showToast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(andAnother: boolean) {
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.post("/api/students", { ...form, ...(groupId ? { orgUnitId: groupId } : {}) });
      onCreated();
      showToast(`${form.name} added.`);
      if (andAnother) {
        // Keep the group — the next student is almost always for the same one.
        setForm(EMPTY_FORM);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add student.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add student"
      onClose={onClose}
      busy={busy}
      actions={
        <>
          <button type="button" className="btn btn-secondary" disabled={busy || !form.name.trim()} onClick={() => submit(true)}>
            Save &amp; add another
          </button>
          <button type="submit" form="add-student" className="btn btn-primary" disabled={busy}>
            {busy ? "Adding…" : "Add student"}
          </button>
        </>
      }
    >
      <form
        id="add-student"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <FormField label="Name" required error={fields.name}>
          <TextInput required autoFocus autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Group (optional)">
          <GroupSelect value={groupId} onChange={setGroupId} emptyLabel="Not in a group yet" />
        </FormField>
        <FormField label="Phone (optional)" error={fields.phone}>
          <TextInput type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </FormField>
        <FormField label="Guardian name (optional)" error={fields.guardianName}>
          <TextInput value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
        </FormField>
        <FormField label="Guardian phone (optional)" error={fields.guardianPhone}>
          <TextInput type="tel" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
        </FormField>
        <FormField label="Guardian email (optional)" error={fields.guardianEmail}>
          <TextInput type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} />
        </FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

const IMPORT_HINT = `Name\tPhone\tGuardian name\tGuardian phone\tGuardian email
Asha Rao\t9876543210\tR. Rao\t9876500000\trao@example.com`;

interface ImportPreview {
  valid: number;
  errors: { row: number; error: string }[];
}

function ImportStudentsModal({
  defaultGroupId,
  onClose,
  onImported,
}: {
  defaultGroupId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const showToast = useToast();
  const [text, setText] = useState("");
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = parseStudentRows(text);

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<ImportPreview & { created: number }>("/api/students/bulk", {
        rows,
        dryRun,
        ...(groupId ? { orgUnitId: groupId } : {}),
      });
      if (dryRun) {
        setPreview(res);
      } else {
        onImported();
        showToast(`${res.created} student${res.created === 1 ? "" : "s"} imported.`);
        onClose();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not import.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Import students"
      wide
      onClose={onClose}
      busy={busy}
      actions={
        preview && preview.valid > 0 ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(false)}>
            {busy ? "Importing…" : `Import ${preview.valid} student${preview.valid === 1 ? "" : "s"}`}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy || rows.length === 0} onClick={() => run(true)}>
            {busy ? "Checking…" : "Check list"}
          </button>
        )
      }
    >
      <p className="text-muted" style={{ marginTop: 0, fontSize: 13 }}>
        Paste rows copied from Excel or Google Sheets (or a CSV). Columns: name, phone, guardian name, guardian phone,
        guardian email — only the name is required.
      </p>
      <FormField label="Group (optional)">
        <GroupSelect value={groupId} onChange={setGroupId} emptyLabel="Don't place in a group" />
      </FormField>
      <FormField label="Students">
        <textarea
          className="input"
          rows={7}
          placeholder={IMPORT_HINT}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
        />
      </FormField>
      <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
        {rows.length} row{rows.length === 1 ? "" : "s"} detected.
      </p>
      {preview && (
        <div className={`banner ${preview.errors.length ? "banner-warning" : "banner-info"}`} style={{ marginTop: 12 }} role="status">
          <div>
            <strong>{preview.valid}</strong> ready to import
            {preview.errors.length > 0 && (
              <>
                , <strong>{preview.errors.length}</strong> to fix first:
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {preview.errors.slice(0, 6).map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.error}
                    </li>
                  ))}
                  {preview.errors.length > 6 && <li>…and {preview.errors.length - 6} more</li>}
                </ul>
                <div style={{ marginTop: 6 }}>Rows with problems are skipped.</div>
              </>
            )}
          </div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  );
}

function InviteStudentModal({ student, onClose, onInvited }: { student: Student; onClose: () => void; onInvited: () => void }) {
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
