import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError } from "../../lib/api";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { FormField, Select, TextInput } from "../../components/FormField";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "TEACHER";
  isActive: boolean;
  createdAt: string;
}

export function StaffPage() {
  const { identity } = useAuth();
  const isOwner = identity?.kind === "STAFF" && identity.role === "OWNER";

  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "TEACHER" as "OWNER" | "TEACHER" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get<Staff[]>("/api/staff").then(setStaff);
  }

  useEffect(load, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/staff", { ...form, email: form.email.trim().toLowerCase() });
      setShowAdd(false);
      setForm({ name: "", email: "", role: "TEACHER" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add staff member.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(id: string) {
    await api.patch(`/api/staff/${id}/deactivate`);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Staff</h1>
        {isOwner && (
          <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
            Add staff
          </button>
        )}
      </div>

      {staff && (
        <DataTable
          rows={staff}
          rowKey={(s) => s.id}
          emptyMessage="No staff yet."
          columns={[
            { header: "Name", render: (s) => s.name },
            { header: "Email", render: (s) => s.email },
            { header: "Role", render: (s) => s.role },
            { header: "Status", render: (s) => (s.isActive ? "Active" : "Deactivated") },
            {
              header: "",
              render: (s) =>
                isOwner && s.isActive && s.id !== identity?.id ? (
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: 0 }} onClick={() => handleDeactivate(s.id)}>
                    Deactivate
                  </button>
                ) : null,
            },
          ]}
        />
      )}

      {showAdd && (
        <Modal title="Add staff member" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <FormField label="Name">
              <TextInput required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <TextInput type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormField>
            <FormField label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "OWNER" | "TEACHER" })}>
                <option value="TEACHER">Teacher</option>
                <option value="OWNER">Owner</option>
              </Select>
            </FormField>
            {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Adding…" : "Add staff member"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
