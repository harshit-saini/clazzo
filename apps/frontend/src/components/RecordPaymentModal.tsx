import { useId, useState } from "react";
import { api, ApiError, fieldErrors } from "../lib/api";
import { isoDay, rupees } from "../lib/format";
import { Modal } from "./Modal";
import { FormField, Select, TextInput } from "./FormField";
import { useToast } from "./ToastContext";

export interface PayableInvoice {
  id: string;
  amount: string;
  payments: { amount: string }[];
  student?: { name: string };
}

/**
 * Records a payment against one invoice. Shared by the Fees list and the
 * student page so both offer the same fields: amount (defaults to the
 * balance), method, date received and an optional note/reference.
 */
export function RecordPaymentModal({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: PayableInvoice;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const formId = useId();
  const showToast = useToast();
  const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(invoice.amount) - paid);
  const [form, setForm] = useState({ amount: remaining.toFixed(2), method: "CASH", paidAt: isoDay(0), notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.post(`/api/invoices/${invoice.id}/payments`, {
        amount: Number(form.amount),
        method: form.method,
        paidAt: form.paidAt || undefined,
        notes: form.notes.trim() || undefined,
      });
      onRecorded();
      onClose();
      showToast(`Payment of ${rupees(form.amount)} recorded${invoice.student ? ` for ${invoice.student.name}` : ""}.`);
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
        <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
          {busy ? "Recording…" : "Record payment"}
        </button>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <p className="text-muted" style={{ marginTop: 0 }}>
          {invoice.student && <strong>{invoice.student.name} · </strong>}
          {rupees(remaining)} remaining of {rupees(invoice.amount)}
        </p>
        <FormField label="Amount (₹)" required error={fields.amount}>
          <TextInput
            type="number"
            min="0.01"
            max={remaining}
            step="0.01"
            inputMode="decimal"
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
        <FormField label="Date received" error={fields.paidAt}>
          <TextInput type="date" max={isoDay(0)} value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} />
        </FormField>
        <FormField label="Note or reference (optional)">
          <TextInput value={form.notes} maxLength={200} placeholder="Receipt no., UPI ref…" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
