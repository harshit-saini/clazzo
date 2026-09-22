import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { FormField, Select, TextInput } from "../../components/FormField";

interface Batch {
  id: string;
  name: string;
  subject: string | null;
  primaryTeacher: { id: string; name: string } | null;
  _count: { enrollments: number };
}

interface Staff {
  id: string;
  name: string;
  isActive: boolean;
}

interface Grade {
  id: string;
  name: string;
}

export function BatchesPage() {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  function load() {
    api.get<Batch[]>("/api/batches").then(setBatches);
  }

  useEffect(() => {
    load();
    api.get<Staff[]>("/api/staff").then((s) => setStaff(s.filter((x) => x.isActive)));
    api.get<Grade[]>("/api/grades").then(setGrades);
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Batches</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          New batch
        </button>
      </div>

      {batches && (
        <DataTable
          rows={batches}
          rowKey={(b) => b.id}
          emptyMessage="No batches yet."
          columns={[
            { header: "Name", render: (b) => <Link to={`/dashboard/batches/${b.id}`}>{b.name}</Link> },
            { header: "Subject", render: (b) => b.subject ?? "—" },
            { header: "Teacher", render: (b) => b.primaryTeacher?.name ?? "—" },
            { header: "Students", render: (b) => b._count.enrollments },
          ]}
        />
      )}

      {showAdd && (
        <AddBatchModal staff={staff} grades={grades} onClose={() => setShowAdd(false)} onCreated={load} />
      )}
    </div>
  );
}

function AddBatchModal({
  staff,
  grades,
  onClose,
  onCreated,
}: {
  staff: Staff[];
  grades: Grade[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: "", subject: "", primaryTeacherId: "", gradeId: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/batches", {
        name: form.name,
        subject: form.subject || undefined,
        primaryTeacherId: form.primaryTeacherId || undefined,
        gradeId: form.gradeId || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create batch.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New batch" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormField label="Name">
          <TextInput required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Subject (optional)">
          <TextInput value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </FormField>
        <FormField label="Teacher (optional)">
          <Select value={form.primaryTeacherId} onChange={(e) => setForm({ ...form, primaryTeacherId: e.target.value })}>
            <option value="">—</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Grade (optional)">
          <Select value={form.gradeId} onChange={(e) => setForm({ ...form, gradeId: e.target.value })}>
            <option value="">—</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </FormField>
        {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Creating…" : "Create batch"}
        </button>
      </form>
    </Modal>
  );
}
