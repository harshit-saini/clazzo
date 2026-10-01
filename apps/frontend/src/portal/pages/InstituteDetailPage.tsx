import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { AttendanceTag, InvoiceStatusTag } from "../../components/StatusTag";
import { FeeSummaryStrip } from "../../components/FeeSummaryStrip";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader, SectionHeader } from "../../components/PageHeader";
import { WEEKDAYS, formatDate, formatTimeRange, rupees } from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { ConsentPendingBanner } from "../ConsentPendingBanner";

interface Course {
  courseId: string;
  name: string;
  code: string | null;
  group: { id: string; name: string };
  teacher: { id: string; name: string } | null;
  schedule: { dayOfWeek: number; startTime: string; endTime: string }[];
  attendance: { present: number; total: number };
}

interface Payment {
  amount: string;
  method: string;
}

interface Invoice {
  id: string;
  amount: string;
  dueDate: string;
  /** Effective status — an unpaid invoice past its due date arrives as OVERDUE. */
  status: string;
  payments: Payment[];
}

interface InstituteDetail {
  institute: { id: string; name: string; type: string };
  groups: { id: string; name: string; breadcrumb: string[] }[];
  consentStatus: "NOT_REQUIRED" | "PENDING" | "CONFIRMED" | "REVOKED";
  maskedGuardianEmail?: string | null;
  courses: Course[];
  invoices: Invoice[];
}

// Monday first reads more naturally for a school week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function InstituteDetailPage() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const { data: detail, loading, error, reload } = useApiData<InstituteDetail>(
    () => api.get<InstituteDetail>(`/api/student/institutes/${instituteId}`),
    [instituteId]
  );
  useDocumentTitle(detail?.institute.name ?? "Institute");

  return (
    <AsyncState loading={loading} error={error} data={detail} onRetry={reload} backTo="/portal" backLabel="Back to institutes">
      {(detail) => {
        const gated = detail.consentStatus === "PENDING" || detail.consentStatus === "REVOKED";
        const crumbs = [{ label: "My institutes", to: "/portal" }, { label: detail.institute.name }];

        if (gated) {
          return (
            <div>
              <PageHeader breadcrumbs={crumbs} title={detail.institute.name} />
              <ConsentPendingBanner revoked={detail.consentStatus === "REVOKED"} maskedEmail={detail.maskedGuardianEmail} />
              <Link to="/portal" className="btn btn-secondary">
                Back to my institutes
              </Link>
            </div>
          );
        }

        // Weekly timetable: every slot of every subject, grouped by weekday.
        const byDay = new Map<number, { key: string; start: string; end: string; subject: string; teacher: string | null }[]>();
        for (const c of detail.courses) {
          for (const s of c.schedule) {
            const list = byDay.get(s.dayOfWeek) ?? [];
            list.push({ key: `${c.courseId}-${s.startTime}`, start: s.startTime, end: s.endTime, subject: c.name, teacher: c.teacher?.name ?? null });
            byDay.set(s.dayOfWeek, list);
          }
        }
        const scheduleDays = WEEK_ORDER.filter((d) => byDay.has(d));

        return (
          <div>
            <PageHeader
              breadcrumbs={crumbs}
              title={detail.institute.name}
              subtitle={detail.groups.map((g) => g.breadcrumb.join(" › ")).join(", ") || "Not placed in a group yet"}
              actions={
                <Link to={`/portal/institutes/${instituteId}/attendance`} className="btn btn-secondary btn-sm">
                  Attendance history
                </Link>
              }
            />

            <section>
              <SectionHeader title="Subjects" />
              {detail.courses.length === 0 ? (
                <EmptyState title="No subjects have been set up for your group yet." />
              ) : (
                <div className="stack">
                  {detail.courses.map((c) => {
                    const pct = c.attendance.total > 0 ? Math.round((c.attendance.present / c.attendance.total) * 100) : null;
                    return (
                      <div key={c.courseId} className="card card-md elev-sm">
                        <div className="row-between">
                          <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>{c.name}</span>
                          {pct !== null && (
                            <span className="row" style={{ gap: 6 }}>
                              <AttendanceTag pct={pct} />
                              <span className="text-muted" style={{ fontSize: 12 }}>
                                ({c.attendance.present}/{c.attendance.total})
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>
                          {c.teacher?.name ?? "No teacher assigned"} · {c.group.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={{ marginTop: 28 }}>
              <SectionHeader title="Weekly schedule" />
              {scheduleDays.length === 0 ? (
                <EmptyState title="No class times have been set yet." />
              ) : (
                <div className="stack-lg">
                  {scheduleDays.map((d) => (
                    <div key={d}>
                      <h3 className="portal-day" style={{ marginTop: 0 }}>{WEEKDAYS[d]}</h3>
                      <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {[...(byDay.get(d) ?? [])]
                          .sort((a, b) => a.start.localeCompare(b.start))
                          .map((s) => (
                            <li key={s.key} className="list-row">
                              <div>
                                <div style={{ fontWeight: 600 }}>{s.subject}</div>
                                {s.teacher && <div className="text-muted" style={{ fontSize: 13 }}>{s.teacher}</div>}
                              </div>
                              <span style={{ fontSize: 14 }}>{formatTimeRange(s.start, s.end)}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={{ marginTop: 28 }}>
              <SectionHeader
                title="Fees"
                actions={<Link to={`/portal/institutes/${instituteId}/attendance`}>Full attendance history →</Link>}
              />
              <FeeSummaryStrip invoices={detail.invoices} />
              {detail.invoices.length === 0 ? (
                <EmptyState title="No invoices yet." />
              ) : (
                <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {detail.invoices.map((inv) => {
                    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
                    return (
                      <li key={inv.id} className="list-row">
                        <div>
                          <div style={{ fontSize: 14.5 }}>{rupees(inv.amount)}</div>
                          <div className="text-muted" style={{ fontSize: 12.5 }}>
                            Due {formatDate(inv.dueDate)} · Paid {rupees(paid)}
                          </div>
                        </div>
                        <InvoiceStatusTag status={inv.status} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        );
      }}
    </AsyncState>
  );
}
