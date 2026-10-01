import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { FormField, Select, TextInput } from "../../components/FormField";
import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../components/ToastContext";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

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

const ROLE_HELP: Record<StaffRole, string> = {
  TEACHER: "Marks attendance and sees only the groups and subjects they teach.",
  ACCOUNTANT: "Manages fees and payments. Can't see attendance or change the structure.",
  OWNER: "Full access, including staff, structure and fees.",
};

function RoleOptions() {
  return (
    <>
      <option value="TEACHER">Teacher</option>
      <option value="ACCOUNTANT">Accountant</option>
      <option value="OWNER">Owner</option>
    </>
  );
}

export function StaffPage() {
  useDocumentTitle("Staff");
  const { identity, refresh } = useAuth();
  const isOwner = identity?.kind === "STAFF" && identity.role === "OWNER";
  const showToast = useToast();

  const { data: staff, loading, error, reload } = useApiData(() => api.get<Staff[]>("/api/staff"));
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Staff | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Staff | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function handleDeactivateConfirmed() {
    if (!deactivateTarget) return;
    setActionBusy(true);
    try {
      const name = deactivateTarget.name;
      await api.patch(`/api/staff/${deactivateTarget.id}/deactivate`);
      setDeactivateTarget(null);
      reload();
      showToast(`${name} deactivated.`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not deactivate.", "error");
      setDeactivateTarget(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReactivate(id: string, name: string) {
    try {
      await api.patch(`/api/staff/${id}/activate`);
      reload();
      showToast(`${name} reactivated.`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not reactivate.", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Everyone who can sign in to run this institute."
        actions={
          isOwner && (
            <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
              Add staff
            </button>
          )
        }
      />

      <AsyncState loading={loading} error={error} data={staff} onRetry={reload}>
        {(staff) => (
          <>
            <DataTable
              caption="Staff"
              rows={staff}
              rowKey={(s) => s.id}
              emptyMessage="No staff yet."
              columns={[
                {
                  header: "Name",
                  primary: true,
                  sortValue: (s) => s.name,
                  render: (s) => (
                    <>
                      {s.name}
                      {s.id === identity?.id && <span className="tag tag-neutral" style={{ marginLeft: 8 }}>You</span>}
                    </>
                  ),
                },
                { header: "Email", render: (s) => s.email },
                {
                  header: "Role",
                  sortValue: (s) => ROLE_LABEL[s.role],
                  render: (s) => <span title={ROLE_HELP[s.role]}>{ROLE_LABEL[s.role]}</span>,
                },
                {
                  header: "Status",
                  render: (s) =>
                    s.isActive ? <span className="tag tag-accent-2">Active</span> : <span className="tag tag-neutral">Deactivated</span>,
                },
                ...(isOwner
                  ? [
                      {
                        header: "",
                        srHeader: "Actions",
                        render: (s: Staff) => (
                          <div className="row" style={{ gap: 2, flexWrap: "nowrap" }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-label={`Edit ${s.name}`}
                              onClick={() => setEditTarget(s)}
                            >
                              Edit
                            </button>
                            {s.id !== identity?.id &&
                              (s.isActive ? (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm btn-ghost-danger"
                                  aria-label={`Deactivate ${s.name}`}
                                  onClick={() => setDeactivateTarget(s)}
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  aria-label={`Reactivate ${s.name}`}
                                  onClick={() => handleReactivate(s.id, s.name)}
                                >
                                  Reactivate
                                </button>
                              ))}
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />

            <section className="card card-md" style={{ marginTop: 24 }} aria-labelledby="roles-heading">
              <h2 className="section-title" id="roles-heading" style={{ marginBottom: 4 }}>
                What each role can do
              </h2>
              <dl className="sd-dl">
                {(Object.keys(ROLE_HELP) as StaffRole[]).map((r) => (
                  <div key={r} style={{ display: "contents" }}>
                    <dt>{ROLE_LABEL[r]}</dt>
                    <dd>{ROLE_HELP[r]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}
      </AsyncState>

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onAdded={reload} />}
      {editTarget && (
        <EditStaffModal
          staff={editTarget}
          isSelf={editTarget.id === identity?.id}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            reload();
            // The signed-in user's own name is shown in the sidebar.
            if (editTarget.id === identity?.id) void refresh();
          }}
        />
      )}

      {deactivateTarget && (
        <ConfirmModal
          title={`Deactivate ${deactivateTarget.name}?`}
          confirmLabel="Deactivate"
          variant="danger"
          busy={actionBusy}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={handleDeactivateConfirmed}
          body="They'll lose access immediately — their current session is revoked, not just blocked at next login. You can reactivate them anytime from this page."
        />
      )}
    </div>
  );
}

function AddStaffModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const showToast = useToast();
  const [form, setForm] = useState({ name: "", email: "", role: "TEACHER" as StaffRole });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.post("/api/staff", { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() });
      onAdded();
      onClose();
      showToast(`${form.name.trim()} added as ${ROLE_LABEL[form.role]}. A welcome email is on its way.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add staff member.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add staff member"
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="add-staff" className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add staff member"}
        </button>
      }
    >
      <form id="add-staff" onSubmit={handleSubmit}>
        <FormField label="Name" required error={fields.name}>
          <TextInput required autoFocus autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Email" required error={fields.email}>
          <TextInput type="email" required autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </FormField>
        <FormField label="Role" error={fields.role}>
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
            <RoleOptions />
          </Select>
        </FormField>
        <p className="sd-help" style={{ marginTop: -6 }}>{ROLE_HELP[form.role]}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

function EditStaffModal({ staff, isSelf, onClose, onSaved }: { staff: Staff; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const showToast = useToast();
  const [form, setForm] = useState({ name: staff.name, role: staff.role });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const unchanged = form.name.trim() === staff.name && form.role === staff.role;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.patch(`/api/staff/${staff.id}`, {
        name: form.name.trim(),
        // Never send the role for yourself — the API rejects changing it.
        ...(isSelf ? {} : { role: form.role }),
      });
      onSaved();
      onClose();
      showToast(`${form.name.trim()} updated.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Edit ${staff.name}`}
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="edit-staff" className="btn btn-primary" disabled={busy || unchanged || !form.name.trim()}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      }
    >
      <form id="edit-staff" onSubmit={handleSubmit}>
        <FormField label="Name" required error={fields.name}>
          <TextInput required autoFocus autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Role" error={fields.role}>
          <Select value={form.role} disabled={isSelf} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
            <RoleOptions />
          </Select>
        </FormField>
        <p className="sd-help" style={{ marginTop: -6 }}>
          {isSelf ? "You can't change your own role, so the institute always has someone who can manage it." : ROLE_HELP[form.role]}
        </p>
        <p className="sd-help">Email ({staff.email}) can't be changed here.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
