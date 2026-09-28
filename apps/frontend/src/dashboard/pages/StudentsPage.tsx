import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { FormField, TextInput } from "../../components/FormField";
import { useToast } from "../../components/ToastContext";

const PAGE_SIZE = 50;

interface Student {
  id: string;
  name: string;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  studentAccountId: string | null;
  consentStatus: "NOT_REQUIRED" | "PENDING" | "CONFIRMED";
  enrollments: { orgUnit: { id: string; name: string; depth: number } }[];
}

interface StudentPage {
  items: Student[];
  total: number;
}

export function StudentsPage() {
  const { identity } = useAuth();
  const isOwner = identity?.kind === "STAFF" && identity.role === "OWNER";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
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

  const { data, loading, error, reload } = useApiData<StudentPage>(
    () =>
      api.get<StudentPage>(
        `/api/students?take=${PAGE_SIZE}&skip=${page * PAGE_SIZE}${
          debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""
        }`
      ),
    [debouncedSearch, page]
  );

  function accessLabel(s: Student) {
    if (!s.studentAccountId) return "No access";
    if (s.consentStatus === "PENDING") return "Pending guardian";
    return "Active";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Students</h1>
        {isOwner && (
          <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
            Add student
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <TextInput placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <AsyncState loading={loading} error={error} data={data} onRetry={reload}>
        {(page_) => (
          <>
            <DataTable
              rows={page_.items}
              rowKey={(s) => s.id}
              emptyMessage="No students yet."
              columns={[
                { header: "Name", render: (s) => <Link to={`/dashboard/students/${s.id}`}>{s.name}</Link> },
                { header: "Groups", render: (s) => s.enrollments.map((e) => e.orgUnit.name).join(", ") || "—" },
                { header: "Portal access", render: (s) => accessLabel(s) },
                {
                  header: "",
                  render: (s) =>
                    isOwner && !s.studentAccountId ? (
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setInviteTarget(s)}>
                        Invite
                      </button>
                    ) : null,
                },
              ]}
            />
            {page_.total > PAGE_SIZE && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 13 }}>
                <span style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, page_.total)} of {page_.total}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
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

      {showAdd && <AddStudentModal onClose={() => setShowAdd(false)} onCreated={reload} />}
      {inviteTarget && <InviteStudentModal student={inviteTarget} onClose={() => setInviteTarget(null)} onInvited={reload} />}
    </div>
  );
}

function AddStudentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const showToast = useToast();
  const [form, setForm] = useState({ name: "", phone: "", guardianName: "", guardianPhone: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/students", form);
      onCreated();
      onClose();
      showToast(`${form.name} added.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add student.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add student" onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit}>
        <FormField label="Name" required>
          <TextInput required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Phone (optional)">
          <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </FormField>
        <FormField label="Guardian name (optional)">
          <TextInput value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
        </FormField>
        <FormField label="Guardian phone (optional)">
          <TextInput value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
        </FormField>
        {error && <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Adding…" : "Add student"}
        </button>
      </form>
    </Modal>
  );
}

function InviteStudentModal({ student, onClose, onInvited }: { student: Student; onClose: () => void; onInvited: () => void }) {
  const showToast = useToast();
  const [email, setEmail] = useState("");
  const [guardianEmail, setGuardianEmail] = useState(student.guardianEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Invite ${student.name}`} onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit}>
        <FormField label="Student's email" required>
          <TextInput type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Guardian's email (optional — requires their confirmation before access activates)">
          <TextInput type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
        </FormField>
        {error && <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Sending…" : "Send invite"}
        </button>
      </form>
    </Modal>
  );
}
