const INVOICE_VARIANT: Record<string, string> = {
  PAID: "tag-accent-2",
  PENDING: "tag-neutral",
  PARTIAL: "tag-warning",
  OVERDUE: "tag-danger",
  CANCELLED: "tag-outline",
};

const INVOICE_LABEL: Record<string, string> = {
  PAID: "Paid",
  PENDING: "Pending",
  PARTIAL: "Partly paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

/** An invoice's status — overdue is computed by the API at read time, so this always shows the real state. */
export function InvoiceStatusTag({ status }: { status: string }) {
  return <span className={`tag ${INVOICE_VARIANT[status] ?? "tag-neutral"}`}>{INVOICE_LABEL[status] ?? status}</span>;
}

/** Attendance % tinted by how good the number actually is. */
export function AttendanceTag({ pct }: { pct: number }) {
  const variant = pct >= 75 ? "tag-accent-2" : pct >= 50 ? "tag-warning" : "tag-danger";
  return <span className={`tag ${variant}`}>{pct}% attendance</span>;
}

const ATTENDANCE_VARIANT: Record<string, string> = {
  PRESENT: "tag-accent-2",
  LATE: "tag-warning",
  ABSENT: "tag-danger",
  EXCUSED: "tag-neutral",
};

export function AttendanceStatusTag({ status }: { status: string }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={`tag ${ATTENDANCE_VARIANT[status] ?? "tag-neutral"}`}>{label}</span>;
}
