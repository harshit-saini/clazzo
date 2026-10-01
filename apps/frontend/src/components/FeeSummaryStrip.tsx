interface InvoiceLike {
  amount: string;
  status: string;
  payments: { amount: string }[];
}

function remainingOf(invoice: InvoiceLike): number {
  const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  return Number(invoice.amount) - paid;
}

/** A filtered/full invoice table used to require the user to scan or sum
 * the Amount column by hand to see what's actually owed — this surfaces
 * the total (and the overdue slice of it) up front, and updates with
 * whatever filter the caller already applied to `invoices`. */
export function FeeSummaryStrip({ invoices }: { invoices: InvoiceLike[] }) {
  if (invoices.length === 0) return null;

  const outstanding = invoices.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED").reduce((sum, i) => sum + remainingOf(i), 0);
  const overdue = invoices.filter((i) => i.status === "OVERDUE");
  const overdueTotal = overdue.reduce((sum, i) => sum + remainingOf(i), 0);

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      <div className="card" style={{ padding: "10px 16px", flexDirection: "row", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Outstanding</span>
        <strong style={{ fontSize: 15 }}>₹{outstanding.toFixed(2)}</strong>
      </div>
      {overdue.length > 0 && (
        <div
          className="card"
          style={{ padding: "10px 16px", flexDirection: "row", gap: 8, alignItems: "baseline", borderLeft: "3px solid var(--color-danger)" }}
        >
          <span className="tag tag-danger">Overdue</span>
          <strong style={{ fontSize: 15 }}>₹{overdueTotal.toFixed(2)}</strong>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            ({overdue.length} invoice{overdue.length === 1 ? "" : "s"})
          </span>
        </div>
      )}
    </div>
  );
}

export interface FeeSummary {
  outstanding: string;
  overdue: string;
  overdueCount: number;
}

/**
 * Totals across the *whole* filtered set — the server sums every match, not
 * just the page on screen — with the overdue slice called out.
 */
export function FeeTotalsStrip({ summary, total }: { summary: FeeSummary; total: number }) {
  if (total === 0) return null;
  return (
    <div className="stat-grid" style={{ marginBottom: 16 }}>
      <div className="card card-sm">
        <span className="text-muted" style={{ fontSize: 12 }}>Outstanding</span>
        <strong style={{ fontSize: 18 }}>₹{Number(summary.outstanding).toLocaleString("en-IN")}</strong>
      </div>
      <div className="card card-sm" style={summary.overdueCount > 0 ? { borderLeft: "3px solid var(--color-danger)" } : undefined}>
        <span className="text-muted" style={{ fontSize: 12 }}>Overdue</span>
        <strong style={{ fontSize: 18 }}>₹{Number(summary.overdue).toLocaleString("en-IN")}</strong>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {summary.overdueCount} invoice{summary.overdueCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="card card-sm">
        <span className="text-muted" style={{ fontSize: 12 }}>Invoices matching</span>
        <strong style={{ fontSize: 18 }}>{total}</strong>
      </div>
    </div>
  );
}
