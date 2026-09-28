import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { FormField, Select, TextInput } from "../../components/FormField";

type StaffRole = "OWNER" | "TEACHER" | "ACCOUNTANT";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABEL: Record<StaffRole, string> = { OWNER: "Owner", TEACHER: "Teacher", ACCOUNTANT: "Accountant" };

export function StaffPage() {
  const { identity } = useAuth();
  const isOwner = identity?.kind === "STAFF" && identity.role === "OWNER";

  const { data: staff, loading, error, reload } = useApiData(() => api.get<Staff[]>("/api/staff"));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "TEACHER" as StaffRole });
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Staff | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setBusy(true);
    try {
      await api.post("/api/staff", { ...form, email: form.email.trim().toLowerCase() });
      setShowAdd(false);
      setForm({ name: "", email: "", role: "TEACHER" });
      reload();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Could not add staff member.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivateConfirmed() {
    if (!deactivateTarget) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await api.patch(`/api/staff/${deactivateTarget.id}/deactivate`);
      setDeactivateTarget(null);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not deactivate.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReactivate(id: string) {
    setActionError(null);
    try {
      await api.patch(`/api/staff/${id}/activate`);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not reactivate.");
    }
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

      {actionError && <p style={{ color: "var(--color-accent-700)", fontSize: 13, marginBottom: 12 }}>{actionError}</p>}

      <AsyncState loading={loading} error={error} data={staff} onRetry={reload}>
        {(staff) => (
          <DataTable
            rows={staff}
            rowKey={(s) => s.id}
            emptyMessage="No staff yet."
            columns={[
              { header: "Name", render: (s) => s.name },
              { header: "Email", render: (s) => s.email },
              { header: "Role", render: (s) => ROLE_LABEL[s.role] },
              { header: "Status", render: (s) => (s.isActive ? "Active" : "Deactivated") },
              {
                header: "",
                render: (s) => {
                  if (!isOwner || s.id === identity?.id) return null;
                  return s.isActive ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 13, padding: 0 }}
                      onClick={() => setDeactivateTarget(s)}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: 0 }} onClick={() => handleReactivate(s.id)}>
                      Reactivate
                    </button>
                  );
                },
              },
            ]}
          />
        )}
      </AsyncState>

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
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
                <option value="TEACHER">Teacher — sees only the sections/subjects they teach</option>
                <option value="ACCOUNTANT">Accountant — manages fees, nothing else</option>
                <option value="OWNER">Owner — full access</option>
              </Select>
            </FormField>
            {addError && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{addError}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Adding…" : "Add staff member"}
            </button>
          </form>
        </Modal>
      )}

      {deactivateTarget && (
        <ConfirmModal
          title={`Deactivate ${deactivateTarget.name}?`}
          confirmLabel="Deactivate"
          busy={actionBusy}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={handleDeactivateConfirmed}
          body="They'll lose access immediately — their current session is revoked, not just blocked at next login. You can reactivate them anytime from this page."
        />
      )}
    </div>
  );
}
