import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { FormField, Select, TextInput } from "../../components/FormField";

interface Payment {
  id: string;
  amount: string;
  method: string;
  paidAt: string;
}

interface Invoice {
  id: string;
  amount: string;
  dueDate: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  payments: Payment[];
}

interface StudentDetail {
  id: string;
  name: string;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  grade: { id: string; name: string } | null;
  consentStatus: string;
  enrollments: { batch: { id: string; name: string; subject: string | null } }[];
  invoices: Invoice[];
}

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);

  function load() {
    api.get<StudentDetail>(`/api/students/${id}`).then(setStudent);
  }

  useEffect(load, [id]);

  if (!student) return null;

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{student.name}</h1>
      <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 24 }}>
        {student.grade?.name ?? "No grade set"} · {student.phone ?? "No phone on file"}
      </p>

      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Enrolled courses</h2>
      <DataTable
        rows={student.enrollments}
        rowKey={(e) => e.batch.id}
        emptyMessage="Not enrolled in any batch yet."
        columns={[
          { header: "Batch", render: (e) => e.batch.name },
          { header: "Subject", render: (e) => e.batch.subject ?? "—" },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "28px 0 10px" }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Fees</h2>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: 0 }} onClick={() => setShowInvoice(true)}>
          New invoice
        </button>
      </div>
      <DataTable
        rows={student.invoices}
        rowKey={(i) => i.id}
        emptyMessage="No invoices yet."
        columns={[
          { header: "Amount", render: (i) => `₹${i.amount}` },
          { header: "Due", render: (i) => new Date(i.dueDate).toLocaleDateString() },
          { header: "Status", render: (i) => i.status },
          { header: "Paid", render: (i) => `₹${i.payments.reduce((s, p) => s + Number(p.amount), 0)}` },
          {
            header: "",
            render: (i) =>
              i.status !== "PAID" ? (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: 0 }} onClick={() => setPayTarget(i)}>
                  Record payment
                </button>
              ) : null,
          },
        ]}
      />

      {showInvoice && (
        <NewInvoiceModal
          studentId={student.id}
          batches={student.enrollments.map((e) => e.batch)}
          onClose={() => setShowInvoice(false)}
          onCreated={load}
        />
      )}
      {payTarget && <RecordPaymentModal invoice={payTarget} onClose={() => setPayTarget(null)} onRecorded={load} />}
    </div>
  );
}

function NewInvoiceModal({
  studentId,
  batches,
  onClose,
  onCreated,
}: {
  studentId: string;
  batches: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ batchId: batches[0]?.id ?? "", amount: "", dueDate: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/students/${studentId}/invoices`, {
        batchId: form.batchId || undefined,
        amount: Number(form.amount),
        dueDate: form.dueDate,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New invoice" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {batches.length > 0 && (
          <FormField label="Batch">
            <Select value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Amount (₹)">
          <TextInput type="number" min="0" step="0.01" required autoFocus value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </FormField>
        <FormField label="Due date">
          <TextInput type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </FormField>
        {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Creating…" : "Create invoice"}
        </button>
      </form>
    </Modal>
  );
}

function RecordPaymentModal({ invoice, onClose, onRecorded }: { invoice: Invoice; onClose: () => void; onRecorded: () => void }) {
  const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Number(invoice.amount) - paid;
  const [form, setForm] = useState({ amount: remaining.toFixed(2), method: "CASH" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/invoices/${invoice.id}/payments`, { amount: Number(form.amount), method: form.method });
      onRecorded();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Record payment" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
          ₹{remaining.toFixed(2)} remaining of ₹{invoice.amount}
        </p>
        <FormField label="Amount (₹)">
          <TextInput type="number" min="0" step="0.01" required autoFocus value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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
        {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Recording…" : "Record payment"}
        </button>
      </form>
    </Modal>
  );
}
