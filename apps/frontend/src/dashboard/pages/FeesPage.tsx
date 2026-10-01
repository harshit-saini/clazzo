import { useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { formatDate, rupees } from "../../lib/format";
import { AsyncState } from "../../components/AsyncState";
import { DataTable } from "../../components/DataTable";
import { FormField, Select, TextInput } from "../../components/FormField";
import { GroupSelect } from "../../components/GroupSelect";
import { Modal } from "../../components/Modal";
import { PageHeader } from "../../components/PageHeader";
import { InvoiceStatusTag } from "../../components/StatusTag";
import { FeeTotalsStrip, type FeeSummary } from "../../components/FeeSummaryStrip";
import { RecordPaymentModal } from "../../components/RecordPaymentModal";
import { useToast } from "../../components/ToastContext";
import { useUnits } from "../../lib/useUnits";

interface Invoice {
  id: string;
  amount: string;
  dueDate: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  period?: string | null;
  student: { id: string; name: string };
  orgUnit?: { id: string; name: string } | null;
  payments: { amount: string }[];
}

interface InvoicePage {
  items: Invoice[];
  total: number;
  summary: FeeSummary;
}

const PAGE_SIZE = 25;

function paidOf(i: Invoice) {
  return i.payments.reduce((s, p) => s + Number(p.amount), 0);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function FeesPage() {
  useDocumentTitle("Fees");
  const { identity } = useAuth();
  const isOwner = identity?.kind === "STAFF" && identity.role === "OWNER";
  const [params, setParams] = useSearchParams();

  const status = params.get("status") ?? "";
  const orgUnitId = params.get("orgUnitId") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? "0") || 0;

  const [paying, setPaying] = useState<Invoice | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }

  // Debounce typing in the search box so each keystroke isn't a request.
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => setFilter("search", searchInput.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const query = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(page * PAGE_SIZE) });
  if (status) query.set("status", status);
  if (orgUnitId) query.set("orgUnitId", orgUnitId);
  if (from) query.set("from", `${from}-01`);
  if (to) {
    // "to" is a month: include its last day.
    const [y, m] = to.split("-").map(Number);
    query.set("to", new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10));
  }
  if (search) query.set("search", search);

  const { data, loading, error, reload } = useApiData(
    () => api.get<InvoicePage>(`/api/invoices?${query.toString()}`),
    [query.toString()]
  );

  const hasFilters = Boolean(status || orgUnitId || from || to || search);

  return (
    <div>
      <PageHeader
        title="Fees"
        subtitle="Invoices across every group. Overdue is worked out from the due date, so it is always up to date."
        actions={
          isOwner ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowGenerate(true)}>
              Generate invoices
            </button>
          ) : undefined
        }
      />

      <form className="inline-form" role="search" aria-label="Filter invoices" onSubmit={(e) => e.preventDefault()} style={{ marginBottom: 16 }}>
        <div style={{ flex: "1 1 180px" }}>
          <TextInput
            type="search"
            aria-label="Search by student name"
            placeholder="Search student…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select aria-label="Status" value={status} onChange={(e) => setFilter("status", e.target.value)} style={{ width: 150 }}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIAL">Partly paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
        <div style={{ minWidth: 160 }}>
          <GroupSelect aria-label="Group" value={orgUnitId} onChange={(v) => setFilter("orgUnitId", v)} emptyLabel="All groups" />
        </div>
        <label className="text-muted" style={{ fontSize: 13 }}>
          Due from{" "}
          <TextInput type="month" value={from} onChange={(e) => setFilter("from", e.target.value)} style={{ width: 150 }} />
        </label>
        <label className="text-muted" style={{ fontSize: 13 }}>
          to{" "}
          <TextInput type="month" value={to} onChange={(e) => setFilter("to", e.target.value)} style={{ width: 150 }} />
        </label>
        {hasFilters && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSearchInput("");
              setParams({}, { replace: true });
            }}
          >
            Clear filters
          </button>
        )}
      </form>

      <AsyncState loading={loading} error={error} data={data} onRetry={reload}>
        {({ items, total, summary }) => (
          <>
            <FeeTotalsStrip summary={summary} total={total} />
            <DataTable
              caption="Invoices"
              rows={items}
              rowKey={(i) => i.id}
              emptyMessage={
                hasFilters ? "No invoices match these filters." : "No invoices yet. Use “Generate invoices” to bill a group for a month."
              }
              columns={[
                {
                  header: "Student",
                  primary: true,
                  sortValue: (i) => i.student.name,
                  render: (i) => <Link to={`/dashboard/students/${i.student.id}`}>{i.student.name}</Link>,
                },
                { header: "Group", sortValue: (i) => i.orgUnit?.name ?? "", render: (i) => i.orgUnit?.name ?? "—" },
                { header: "Amount", sortValue: (i) => Number(i.amount), render: (i) => rupees(i.amount) },
                { header: "Paid", sortValue: paidOf, render: (i) => rupees(paidOf(i)) },
                { header: "Due", sortValue: (i) => i.dueDate, render: (i) => formatDate(i.dueDate) },
                { header: "Status", sortValue: (i) => i.status, render: (i) => <InvoiceStatusTag status={i.status} /> },
                {
                  header: "",
                  srHeader: "Actions",
                  render: (i) =>
                    i.status === "PAID" || i.status === "CANCELLED" ? null : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-label={`Record payment for ${i.student.name}`}
                        onClick={() => setPaying(i)}
                      >
                        Record payment
                      </button>
                    ),
                },
              ]}
            />
            {total > PAGE_SIZE && (
              <nav className="row-between" aria-label="Pagination" style={{ marginTop: 14 }}>
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
                </span>
                <span className="row">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setFilter("page", String(page - 1))}>
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={(page + 1) * PAGE_SIZE >= total}
                    onClick={() => setFilter("page", String(page + 1))}
                  >
                    Next
                  </button>
                </span>
              </nav>
            )}
          </>
        )}
      </AsyncState>

      {paying && <RecordPaymentModal invoice={paying} onClose={() => setPaying(null)} onRecorded={reload} />}
      {showGenerate && <GenerateInvoicesModal onClose={() => setShowGenerate(false)} onDone={reload} />}
    </div>
  );
}

interface GenerateResult {
  created: number;
  toCreate: number;
  skipped: number;
  studentCount: number;
  amountEach: string;
  total: string;
  dueDate: string;
}

/**
 * Bills a whole group for a month in one go. Always previews first (dry
 * run) so the owner sees how many invoices — and how much money — before
 * anything is written; students already billed for that month are skipped,
 * so running it twice never double-bills.
 */
function GenerateInvoicesModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const formId = useId();
  const showToast = useToast();
  const { units } = useUnits();
  const [unitId, setUnitId] = useState("");
  const [period, setPeriod] = useState(currentMonth());
  const [preview, setPreview] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const unitName = units.find((u) => u.id === unitId)?.label;

  async function run(dryRun: boolean) {
    setError(null);
    setFields({});
    setBusy(true);
    try {
      const result = await api.post<GenerateResult>(`/api/units/${unitId}/invoices/generate`, { period, dryRun });
      if (dryRun) {
        setPreview(result);
      } else {
        showToast(`${result.created} invoice${result.created === 1 ? "" : "s"} created for ${unitName ?? "the group"}.`);
        onDone();
        onClose();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate invoices.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Generate invoices"
      onClose={onClose}
      busy={busy}
      actions={
        preview ? (
          <button type="button" className="btn btn-primary" disabled={busy || preview.toCreate === 0} onClick={() => run(false)}>
            {busy ? "Creating…" : `Create ${preview.toCreate} invoice${preview.toCreate === 1 ? "" : "s"}`}
          </button>
        ) : (
          <button type="submit" form={formId} className="btn btn-primary" disabled={busy || !unitId}>
            {busy ? "Checking…" : "Preview"}
          </button>
        )
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          run(true);
        }}
      >
        <p className="text-muted" style={{ marginTop: 0 }}>
          Bills every active student in a group using the group's fee structure (or the nearest parent group's). Anyone already
          billed for the month is skipped.
        </p>
        <FormField label="Group" required error={fields.orgUnitId}>
          <GroupSelect
            value={unitId}
            onChange={(v) => {
              setUnitId(v);
              setPreview(null);
            }}
            emptyLabel="Choose a group…"
            required
          />
        </FormField>
        <FormField label="Month" required error={fields.period}>
          <TextInput
            type="month"
            required
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setPreview(null);
            }}
          />
        </FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>

      {preview && (
        <div className="banner banner-info" role="status">
          {preview.toCreate === 0 ? (
            <>
              Nothing to create — {preview.studentCount === 0 ? "this group has no active students." : "everyone is already billed for this month."}
            </>
          ) : (
            <>
              <strong>
                {preview.toCreate} invoice{preview.toCreate === 1 ? "" : "s"} of {rupees(preview.amountEach)}
              </strong>{" "}
              (total {rupees(preview.total)}), due {formatDate(preview.dueDate)}.
              {preview.skipped > 0 && (
                <> {preview.skipped} student{preview.skipped === 1 ? " is" : "s are"} already billed and will be skipped.</>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
