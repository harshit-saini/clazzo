const INVOICE_VARIANT: Record<string, string> = {
  PAID: "tag-accent-2",
  PENDING: "tag-neutral",
  PARTIAL: "tag-warning",
  OVERDUE: "tag-danger",
};

/** An invoice's status used to render as plain text everywhere, making an
 * overdue bill visually indistinguishable from a paid one. */
export function InvoiceStatusTag({ status }: { status: string }) {
  return <span className={`tag ${INVOICE_VARIANT[status] ?? "tag-neutral"}`}>{status}</span>;
}

/** Attendance % used to always render as the same reassuring accent-2 pill
 * regardless of the actual number — this makes it react to how good the
 * number actually is. */
export function AttendanceTag({ pct }: { pct: number }) {
  const variant = pct >= 75 ? "tag-accent-2" : pct >= 50 ? "tag-warning" : "tag-danger";
  return <span className={`tag ${variant}`}>{pct}% attendance</span>;
}
