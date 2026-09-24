import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  status: string;
  payments: Payment[];
}

interface InstituteDetail {
  institute: { id: string; name: string; type: string };
  groups: { id: string; name: string; breadcrumb: string[] }[];
  consentStatus: string;
  courses: Course[];
  invoices: Invoice[];
}

export function InstituteDetailPage() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const [detail, setDetail] = useState<InstituteDetail | null>(null);

  useEffect(() => {
    api.get<InstituteDetail>(`/api/student/institutes/${instituteId}`).then(setDetail);
  }, [instituteId]);

  if (!detail) return null;

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{detail.institute.name}</h1>
      <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 28 }}>
        {detail.groups.map((g) => g.breadcrumb.join(" › ")).join(", ") || "Not placed in a group yet"}
      </p>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Subjects</h2>
      <div style={{ display: "grid", gap: 12, marginBottom: 32 }}>
        {detail.courses.length === 0 && <p>No subjects yet.</p>}
        {detail.courses.map((c) => {
          const pct = c.attendance.total > 0 ? Math.round((c.attendance.present / c.attendance.total) * 100) : null;
          return (
            <div key={c.courseId} className="card elev-sm" style={{ padding: 20, gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>{c.name}</span>
                {pct !== null && (
                  <span className="tag tag-accent-2">
                    {pct}% attendance ({c.attendance.present}/{c.attendance.total})
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13.5, margin: 0, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
                {c.teacher?.name ?? "No teacher assigned"} · {c.group.name}
              </p>
              {c.schedule.length > 0 && (
                <p style={{ fontSize: 13, margin: 0 }}>
                  {c.schedule.map((s) => `${DAYS[s.dayOfWeek]} ${s.startTime}–${s.endTime}`).join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Fees</h2>
        <Link to={`/portal/institutes/${instituteId}/attendance`} style={{ fontSize: 13 }}>
          Full attendance history →
        </Link>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {detail.invoices.length === 0 && <p>No invoices yet.</p>}
        {detail.invoices.map((inv) => {
          const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
          return (
            <div key={inv.id} className="card" style={{ padding: "14px 18px", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14.5 }}>₹{inv.amount}</div>
                <div style={{ fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                  Due {new Date(inv.dueDate).toLocaleDateString()} · Paid ₹{paid}
                </div>
              </div>
              <span className={`tag ${inv.status === "PAID" ? "tag-accent-2" : "tag-accent"}`}>{inv.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
