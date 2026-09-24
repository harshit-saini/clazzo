import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { FormField, TextInput } from "../../components/FormField";

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

export function StudentsPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<Student | null>(null);

  function load(q = "") {
    api.get<Student[]>(`/api/students${q ? `?search=${encodeURIComponent(q)}` : ""}`).then(setStudents);
  }

  useEffect(() => load(), []);

  function accessLabel(s: Student) {
    if (!s.studentAccountId) return "No access";
    if (s.consentStatus === "PENDING") return "Pending guardian";
    return "Active";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Students</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          Add student
        </button>
      </div>

      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <TextInput
          placeholder="Search by name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            load(e.target.value);
          }}
        />
      </div>

      {students && (
        <DataTable
          rows={students}
          rowKey={(s) => s.id}
          emptyMessage="No students yet."
          columns={[
            { header: "Name", render: (s) => <Link to={`/dashboard/students/${s.id}`}>{s.name}</Link> },
            { header: "Groups", render: (s) => s.enrollments.map((e) => e.orgUnit.name).join(", ") || "—" },
            { header: "Portal access", render: (s) => accessLabel(s) },
            {
              header: "",
              render: (s) =>
                !s.studentAccountId ? (
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: 0 }} onClick={() => setInviteTarget(s)}>
                    Invite
                  </button>
                ) : null,
            },
          ]}
        />
      )}

      {showAdd && <AddStudentModal onClose={() => setShowAdd(false)} onCreated={() => load(search)} />}
      {inviteTarget && (
        <InviteStudentModal student={inviteTarget} onClose={() => setInviteTarget(null)} onInvited={() => load(search)} />
      )}
    </div>
  );
}

function AddStudentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add student.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add student" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormField label="Name">
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
        {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Adding…" : "Add student"}
        </button>
      </form>
    </Modal>
  );
}

function InviteStudentModal({ student, onClose, onInvited }: { student: Student; onClose: () => void; onInvited: () => void }) {
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Invite ${student.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormField label="Student's email">
          <TextInput type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Guardian's email (optional — requires their confirmation before access activates)">
          <TextInput type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
        </FormField>
        {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Sending…" : "Send invite"}
        </button>
      </form>
    </Modal>
  );
}
