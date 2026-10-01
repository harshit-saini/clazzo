import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { useApiData, type UseApiDataResult } from "../../lib/useApiData";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { formatDate, formatTimeRange, formatWeekday, isoDay, rupees, WEEKDAYS } from "../../lib/format";
import { AsyncState } from "../../components/AsyncState";
import { ConfirmModal } from "../../components/ConfirmModal";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { FormField, Select, TextInput } from "../../components/FormField";
import { GroupSelect } from "../../components/GroupSelect";
import { Modal } from "../../components/Modal";
import { PageHeader, SectionHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { AttendanceTag, InvoiceStatusTag } from "../../components/StatusTag";
import { useToast } from "../../components/ToastContext";

// ─── Types (shapes come from routes/{structure,schedule,attendance,fees}.ts) ─

type Role = "OWNER" | "TEACHER" | "ACCOUNTANT";

interface FeeStructure {
  amount: string;
  billingCycle: "ONE_TIME" | "MONTHLY" | "QUARTERLY";
  dueDayOfMonth: number | null;
}

interface CourseRow {
  id: string;
  name: string;
  code: string | null;
  enrollmentMode: "ALL_IN_UNIT" | "SELECTED";
  inherited: boolean;
  teacher: { id: string; name: string } | null;
  orgUnit: { id: string; name: string };
}

interface RosterStudent {
  id: string;
  name: string;
  phone: string | null;
}

interface UnitDetail {
  id: string;
  name: string;
  path: string;
  level: { name: string } | null;
  ancestors: { id: string; name: string }[];
  children: { id: string; name: string; level: { name: string } | null }[];
  courses: CourseRow[];
  roster: RosterStudent[];
  feeStructure: FeeStructure | null;
}

interface ScheduleSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  course: { id: string; name: string } | null;
}

type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

interface ClassSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  course: { id: string; name: string } | null;
  _count: { attendance: number };
}

interface AttendanceSummary {
  from: string;
  to: string;
  overall: { present: number; total: number; percent: number | null };
  weeks: { weekOf: string; present: number; total: number; percent: number | null }[];
  lowest: { studentId: string; name: string; present: number; total: number; percent: number | null }[];
}

interface Invoice {
  id: string;
  amount: string;
  dueDate: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  student: { id: string; name: string };
  payments: { amount: string }[];
}

interface InvoiceList {
  items: Invoice[];
  total: number;
  summary: { outstanding: string; overdue: string; overdueCount: number };
}

interface InvoicePreview {
  period: string;
  amountEach: string;
  dueDate: string;
  studentCount: number;
  toCreate: number;
  skipped: number;
  total: string;
  created: number;
}

interface StaffMember {
  id: string;
  name: string;
  role: Role;
  isActive: boolean;
}

type SlotsResult = UseApiDataResult<ScheduleSlot[]>;

// ─── Small helpers ─────────────────────────────────────────────────────────

const TAB_KEYS = ["overview", "students", "timetable", "sessions", "fees"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  overview: "Overview",
  students: "Students",
  timetable: "Subjects & timetable",
  sessions: "Sessions & attendance",
  fees: "Fees",
};

/** Monday first — the week a timetable is read in. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const CYCLE_LABELS: Record<FeeStructure["billingCycle"], string> = {
  ONE_TIME: "One-time",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
};

const DEFAULT_DUE_DAY = 5;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function readStoredRange(key: string, fallback: { from: string; to: string }): { from: string; to: string } {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { from?: unknown; to?: unknown };
      if (typeof parsed.from === "string" && typeof parsed.to === "string") return { from: parsed.from, to: parsed.to };
    }
  } catch {
    // Storage unavailable or corrupt — fall back to the default window.
  }
  return fallback;
}

function storeRange(key: string, range: { from: string; to: string }) {
  try {
    sessionStorage.setItem(key, JSON.stringify(range));
  } catch {
    // Not worth failing the page over.
  }
}

function meterClass(pct: number): string {
  return pct >= 75 ? "ud-meter-good" : pct >= 50 ? "ud-meter-warn" : "ud-meter-bad";
}

/** A bar with the number printed beside it, so the value never relies on colour or length alone. */
function Meter({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) return <span className="text-muted">No data</span>;
  return (
    <div className="ud-meter-row">
      <span className="ud-meter" aria-hidden="true">
        <span className={`ud-meter-fill ${meterClass(pct)}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="ud-meter-label">{label}</span>
    </div>
  );
}

function SessionStatusTag({ status }: { status: SessionStatus }) {
  const variant = status === "COMPLETED" ? "tag-accent-2" : status === "CANCELLED" ? "tag-danger" : "tag-neutral";
  const label = status === "COMPLETED" ? "Completed" : status === "CANCELLED" ? "Cancelled" : "Scheduled";
  return <span className={`tag ${variant}`}>{label}</span>;
}

function slotLabel(slot: ScheduleSlot): string {
  return `${WEEKDAYS[slot.dayOfWeek]} ${formatTimeRange(slot.startTime, slot.endTime)}${slot.course ? ` ${slot.course.name}` : ""}`;
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function UnitDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { identity } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const role: Role | null = identity?.kind === "STAFF" ? identity.role : null;
  const isOwner = role === "OWNER";
  // The accountant has no attendance role — the API returns nothing / 403 for it.
  const canAttendance = role === "OWNER" || role === "TEACHER";
  const canSeeFees = role === "OWNER" || role === "ACCOUNTANT";

  const unitQuery = useApiData<UnitDetail>(() => api.get<UnitDetail>(`/api/structure/units/${id}`), [id]);
  const slotsQuery = useApiData<ScheduleSlot[]>(() => api.get<ScheduleSlot[]>(`/api/units/${id}/schedule`), [id]);
  useDocumentTitle(unitQuery.data?.name ?? "Group");

  const tabs = TAB_KEYS.filter((key) => (key === "sessions" ? canAttendance : key === "fees" ? canSeeFees : true));
  const requested = searchParams.get("tab");
  const active: TabKey = tabs.find((t) => t === requested) ?? "overview";

  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  function selectTab(key: TabKey, focus = false) {
    const next = new URLSearchParams(searchParams);
    if (key === "overview") next.delete("tab");
    else next.set("tab", key);
    setSearchParams(next, { replace: true });
    if (focus) tabRefs.current[key]?.focus();
  }

  function onTabKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.indexOf(active);
    let nextIndex = -1;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex < 0) return;
    e.preventDefault();
    selectTab(tabs[nextIndex], true);
  }

  return (
    <AsyncState
      loading={unitQuery.loading}
      error={unitQuery.error}
      data={unitQuery.data}
      onRetry={unitQuery.reload}
      backTo="/dashboard/structure"
      backLabel="Back to structure"
    >
      {(unit) => {
        const ancestors = [...unit.ancestors].sort((a, b) => unit.path.indexOf(a.id) - unit.path.indexOf(b.id));
        return (
          <div>
            <PageHeader
              breadcrumbs={[
                { label: "Structure", to: "/dashboard/structure" },
                ...ancestors.map((a) => ({ label: a.name, to: `/dashboard/structure/${a.id}` })),
                { label: unit.name },
              ]}
              title={unit.name}
              subtitle={`${unit.level?.name ?? "Group"} · ${plural(unit.roster.length, "student")}`}
            />

            <div className="tabs" role="tablist" aria-label={`${unit.name} sections`} onKeyDown={onTabKeyDown}>
              {tabs.map((key) => (
                <button
                  key={key}
                  ref={(el) => {
                    tabRefs.current[key] = el;
                  }}
                  type="button"
                  role="tab"
                  className="tab"
                  id={`unit-tab-${key}`}
                  aria-selected={active === key}
                  aria-controls={`unit-panel-${key}`}
                  tabIndex={active === key ? 0 : -1}
                  onClick={() => selectTab(key)}
                >
                  {TAB_LABELS[key]}
                </button>
              ))}
            </div>

            <div role="tabpanel" id={`unit-panel-${active}`} aria-labelledby={`unit-tab-${active}`} tabIndex={0}>
              {active === "overview" && (
                <OverviewTab
                  unit={unit}
                  slots={slotsQuery.data}
                  isOwner={isOwner}
                  canAttendance={canAttendance}
                  canSeeFees={canSeeFees}
                  goTo={(key) => selectTab(key)}
                />
              )}
              {active === "students" && <StudentsTab unit={unit} canManage={isOwner} onChanged={unitQuery.reload} />}
              {active === "timetable" && (
                <TimetableTab unit={unit} slotsQuery={slotsQuery} canManage={isOwner} onUnitChanged={unitQuery.reload} />
              )}
              {active === "sessions" && canAttendance && <SessionsTab unit={unit} role={role} />}
              {active === "fees" && canSeeFees && (
                <FeesTab unit={unit} canEditStructure={isOwner} onStructureChanged={unitQuery.reload} />
              )}
            </div>
          </div>
        );
      }}
    </AsyncState>
  );
}

// ─── Overview ──────────────────────────────────────────────────────────────

function OverviewTab({
  unit,
  slots,
  isOwner,
  canAttendance,
  canSeeFees,
  goTo,
}: {
  unit: UnitDetail;
  slots: ScheduleSlot[] | null;
  isOwner: boolean;
  canAttendance: boolean;
  canSeeFees: boolean;
  goTo: (tab: TabKey) => void;
}) {
  const steps: { text: string; tab: TabKey; action: string }[] = [];
  if (isOwner) {
    if (unit.roster.length === 0) steps.push({ text: "No students are in this group yet.", tab: "students", action: "Enrol students" });
    if (unit.courses.length === 0) steps.push({ text: "No subjects have been added.", tab: "timetable", action: "Add a subject" });
    else if (slots && slots.length === 0) steps.push({ text: "There is no weekly timetable.", tab: "timetable", action: "Set up the timetable" });
    if (canSeeFees && !unit.feeStructure) steps.push({ text: "No fee structure is set.", tab: "fees", action: "Set the fees" });
  }
  const emptyForOthers = !isOwner && (unit.roster.length === 0 || unit.courses.length === 0);

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Students" value={unit.roster.length} />
        <StatCard label="Subjects" value={unit.courses.length} accent="accent-2" />
        {unit.children.length > 0 && <StatCard label="Sub-groups" value={unit.children.length} />}
        {canSeeFees && (
          <StatCard
            label="Fee structure"
            accent="accent-2"
            value={
              unit.feeStructure
                ? `${rupees(unit.feeStructure.amount)} ${CYCLE_LABELS[unit.feeStructure.billingCycle].toLowerCase()}`
                : "Not set"
            }
          />
        )}
      </div>

      {steps.length > 0 && (
        <div className="banner banner-info ud-section" role="region" aria-label="Next steps" style={{ display: "block" }}>
          <strong>Next steps</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {steps.map((step) => (
              <li key={step.action} className="row">
                <span>{step.text}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => goTo(step.tab)}>
                  {step.action}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {emptyForOthers && (
        <p className="banner banner-info ud-section">
          This group is still being set up. Ask the institute owner to add students and subjects.
        </p>
      )}

      {unit.children.length > 0 && (
        <section className="ud-section" aria-labelledby="ud-children">
          <h2 className="section-title" id="ud-children">
            Inside this group
          </h2>
          <div className="chips">
            {unit.children.map((child) => (
              <Link key={child.id} to={`/dashboard/structure/${child.id}`} className="btn btn-secondary">
                {child.name}
                {child.level && <span className="tag tag-level">{child.level.name}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {canAttendance && <TodaysClasses unitId={unit.id} />}
      {canAttendance && <AttendanceOverview unitId={unit.id} hasStudents={unit.roster.length > 0} />}
    </div>
  );
}

function TodaysClasses({ unitId }: { unitId: string }) {
  const today = isoDay(0);
  const query = useApiData<ClassSession[]>(
    () => api.get<ClassSession[]>(`/api/units/${unitId}/sessions?from=${today}&to=${today}`),
    [unitId, today]
  );

  return (
    <section className="ud-section" aria-labelledby="ud-today">
      <h2 className="section-title" id="ud-today">
        Today&rsquo;s classes
      </h2>
      <AsyncState loading={query.loading} error={query.error} data={query.data} onRetry={query.reload}>
        {(sessions) =>
          sessions.length === 0 ? (
            <p className="text-muted" style={{ margin: 0 }}>
              No classes are scheduled for this group today.
            </p>
          ) : (
            <div className="stack">
              {sessions.map((s) => {
                const subject = s.course?.name ?? "Whole group";
                const marked = s._count.attendance > 0;
                return (
                  <div key={s.id} className="list-row">
                    <div>
                      <strong>{subject}</strong>
                      <span className="text-muted"> · {formatTimeRange(s.startTime, s.endTime)}</span>
                    </div>
                    <div className="row">
                      <SessionStatusTag status={s.status} />
                      {s.status !== "CANCELLED" && (
                        <Link
                          to={`/dashboard/attendance/${s.id}`}
                          className="btn btn-secondary btn-sm"
                          aria-label={`${marked ? "Edit" : "Mark"} attendance for ${subject} today`}
                        >
                          {marked ? "Edit attendance" : "Mark attendance"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </AsyncState>
    </section>
  );
}

function AttendanceOverview({ unitId, hasStudents }: { unitId: string; hasStudents: boolean }) {
  const query = useApiData<AttendanceSummary>(() => api.get<AttendanceSummary>(`/api/units/${unitId}/attendance-summary`), [unitId]);

  return (
    <section className="ud-section" aria-labelledby="ud-attendance">
      <h2 className="section-title" id="ud-attendance">
        Attendance
      </h2>
      <AsyncState loading={query.loading} error={query.error} data={query.data} onRetry={query.reload}>
        {(summary) => {
          if (summary.overall.total === 0) {
            return (
              <EmptyState
                title={
                  hasStudents
                    ? "No attendance has been marked for this group in the last 8 weeks. Open the Sessions & attendance tab to mark a class."
                    : "Attendance will appear here once students are added and classes are marked."
                }
              />
            );
          }
          return (
            <div className="stack-lg">
              <p style={{ margin: 0 }} className="row">
                {summary.overall.percent !== null && <AttendanceTag pct={summary.overall.percent} />}
                <span className="text-muted">
                  {summary.overall.present} of {summary.overall.total} marks present or late,{" "}
                  {formatDate(summary.from, { day: "numeric", month: "short" })} to {formatDate(summary.to, { day: "numeric", month: "short" })}
                </span>
              </p>

              <DataTable
                caption="Weekly attendance for this group"
                rows={summary.weeks}
                rowKey={(w) => w.weekOf}
                columns={[
                  {
                    header: "Week of",
                    primary: true,
                    render: (w) => formatDate(w.weekOf, { day: "numeric", month: "short" }),
                  },
                  {
                    header: "Attendance",
                    render: (w) => (
                      <Meter pct={w.percent} label={w.percent === null ? "" : `${w.percent}% (${w.present} of ${w.total})`} />
                    ),
                  },
                ]}
              />

              <div>
                <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Lowest attendance</h3>
                {summary.lowest.length === 0 ? (
                  <p className="text-muted" style={{ margin: 0 }}>
                    Students appear here once they have at least 3 marked classes.
                  </p>
                ) : (
                  <DataTable
                    caption="Students with the lowest attendance"
                    rows={summary.lowest}
                    rowKey={(s) => s.studentId}
                    columns={[
                      {
                        header: "Student",
                        primary: true,
                        render: (s) => <Link to={`/dashboard/students/${s.studentId}`}>{s.name}</Link>,
                      },
                      { header: "Attendance", render: (s) => (s.percent === null ? "—" : <AttendanceTag pct={s.percent} />) },
                      { header: "Classes attended", render: (s) => `${s.present} of ${s.total}` },
                    ]}
                  />
                )}
              </div>
            </div>
          );
        }}
      </AsyncState>
    </section>
  );
}

// ─── Students ──────────────────────────────────────────────────────────────

const ROSTER_PREVIEW = 15;

function StudentsTab({ unit, canManage, onChanged }: { unit: UnitDetail; canManage: boolean; onChanged: () => void }) {
  const showToast = useToast();
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [removing, setRemoving] = useState<RosterStudent | null>(null);
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? unit.roster.filter((s) => s.name.toLowerCase().includes(q) || (s.phone ?? "").includes(q)) : unit.roster;
  }, [unit.roster, filter]);
  const collapsed = !showAll && !filter.trim() && matches.length > ROSTER_PREVIEW;
  const visible = collapsed ? matches.slice(0, ROSTER_PREVIEW) : matches;

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api.delete(`/api/structure/units/${unit.id}/enroll/${removing.id}`);
      showToast(`${removing.name} was removed from ${unit.name}.`);
      setRemoving(null);
      onChanged();
    } catch (err) {
      showToast(errorMessage(err, "Could not remove this student. Please try again."), "error");
    } finally {
      setBusy(false);
    }
  }

  const enrolButton = canManage && (
    <button type="button" className="btn btn-primary btn-sm" onClick={() => setEnrolOpen(true)}>
      Enrol students
    </button>
  );

  return (
    <section aria-labelledby="ud-students">
      <SectionHeader title={<span id="ud-students">Students ({unit.roster.length})</span>} actions={enrolButton} />

      {unit.children.length > 0 && (
        <p className="banner banner-info" style={{ marginBottom: 12 }}>
          This list includes students from the groups inside {unit.name}. Removing someone here only takes them out of {unit.name} itself;
          if they are still listed, remove them from their own section.
        </p>
      )}

      {unit.roster.length === 0 ? (
        <EmptyState
          title="Nobody is in this group yet."
          action={
            canManage ? (
              <button type="button" className="btn btn-primary" onClick={() => setEnrolOpen(true)}>
                Enrol students
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {unit.roster.length > ROSTER_PREVIEW && (
            <div className="inline-form" style={{ marginTop: 0, marginBottom: 12 }}>
              <FormField label="Find a student">
                <TextInput
                  type="search"
                  placeholder="Name or phone"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </FormField>
            </div>
          )}
          <DataTable
            caption={`Students in ${unit.name}`}
            rows={visible}
            rowKey={(s) => s.id}
            emptyMessage="No students match that search."
            columns={[
              { header: "Name", primary: true, render: (s) => <Link to={`/dashboard/students/${s.id}`}>{s.name}</Link> },
              { header: "Phone", render: (s) => s.phone ?? "—" },
              {
                header: "",
                srHeader: "Actions",
                render: (s) =>
                  canManage ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-ghost-danger"
                      aria-label={`Remove ${s.name} from this group`}
                      onClick={() => setRemoving(s)}
                    >
                      Remove
                    </button>
                  ) : null,
              },
            ]}
          />
          {collapsed && (
            <p style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAll(true)}>
                Show all {unit.roster.length} students
              </button>
            </p>
          )}
        </>
      )}

      {enrolOpen && (
        <EnrolModal
          unit={unit}
          rosterIds={new Set(unit.roster.map((s) => s.id))}
          onClose={() => setEnrolOpen(false)}
          onEnrolled={(count) => {
            setEnrolOpen(false);
            showToast(`${plural(count, "student")} enrolled in ${unit.name}.`);
            onChanged();
          }}
        />
      )}
      {removing && (
        <ConfirmModal
          title={`Remove ${removing.name}?`}
          body={`${removing.name} will no longer be in ${unit.name}, and won't appear on its attendance lists. Their past attendance and fee records are kept.`}
          confirmLabel="Remove student"
          variant="danger"
          busy={busy}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  );
}

function EnrolModal({
  unit,
  rosterIds,
  onClose,
  onEnrolled,
}: {
  unit: UnitDetail;
  rosterIds: Set<string>;
  onClose: () => void;
  onEnrolled: (count: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useApiData<{ items: { id: string; name: string; phone: string | null }[]; total: number }>(
    () => api.get(`/api/students?take=100&search=${encodeURIComponent(debounced)}`),
    [debounced]
  );
  const available = (results.data?.items ?? []).filter((s) => !rosterIds.has(s.id));
  const truncated = (results.data?.total ?? 0) > (results.data?.items.length ?? 0);

  function toggle(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      setError("Choose at least one student to enrol.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ enrolled: number }>(`/api/structure/units/${unit.id}/enroll`, { studentIds: [...selected] });
      onEnrolled(res.enrolled);
    } catch (err) {
      setError(errorMessage(err, "Could not enrol these students. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Enrol students in ${unit.name}`}
      onClose={onClose}
      busy={busy}
      wide
      actions={
        <button type="submit" form="enrol-form" className="btn btn-primary" disabled={busy || selected.size === 0}>
          {busy ? "Enrolling…" : selected.size > 0 ? `Enrol ${plural(selected.size, "student")}` : "Enrol"}
        </button>
      }
    >
      <form id="enrol-form" onSubmit={submit}>
        <FormField label="Search students">
          <TextInput type="search" placeholder="Name, phone or guardian" value={query} onChange={(e) => setQuery(e.target.value)} />
        </FormField>

        {results.error ? (
          <p className="form-error" role="alert">
            {results.error}{" "}
            <button type="button" className="btn btn-ghost btn-sm" onClick={results.reload}>
              Try again
            </button>
          </p>
        ) : (
          <fieldset className="ud-fieldset">
            <legend>
              {results.loading && !results.data ? "Loading students…" : `Students not in this group (${available.length} shown, ${selected.size} selected)`}
            </legend>
            {available.length === 0 && !results.loading ? (
              <p className="text-muted" style={{ margin: 0 }}>
                {debounced ? "No matching students outside this group." : "Every student is already in this group, or none have been added yet."}
              </p>
            ) : (
              <ul className="ud-pick-list">
                {available.map((s) => (
                  <li key={s.id}>
                    <label className="ud-pick-item">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                      <span>
                        {s.name}
                        {s.phone && <span className="text-muted"> · {s.phone}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}

        <div className="row" style={{ marginBottom: 6 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={available.length === 0}
            onClick={() => setSelected((prev) => new Set([...prev, ...available.map((s) => s.id)]))}
          >
            Select all shown
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
        {truncated && <p className="sd-help">Showing the first 100 matches. Search to narrow the list.</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

// ─── Subjects & timetable ──────────────────────────────────────────────────

function TimetableTab({
  unit,
  slotsQuery,
  canManage,
  onUnitChanged,
}: {
  unit: UnitDetail;
  slotsQuery: SlotsResult;
  canManage: boolean;
  onUnitChanged: () => void;
}) {
  return (
    <div>
      <SubjectsSection unit={unit} canManage={canManage} onChanged={onUnitChanged} />
      <TimetableSection unit={unit} slotsQuery={slotsQuery} canManage={canManage} />
    </div>
  );
}

function SubjectsSection({ unit, canManage, onChanged }: { unit: UnitDetail; canManage: boolean; onChanged: () => void }) {
  const showToast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<CourseRow | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const staff = useApiData<StaffMember[]>(() => (canManage ? api.get<StaffMember[]>("/api/staff") : Promise.resolve([])), [canManage]);
  // Owners can teach too (solo tutors), so they're offered alongside teachers.
  const teachers = (staff.data ?? []).filter((m) => m.isActive && (m.role === "TEACHER" || m.role === "OWNER"));

  async function changeTeacher(course: CourseRow, teacherId: string) {
    if (!teacherId) return;
    setSavingId(course.id);
    try {
      await api.patch(`/api/courses/${course.id}`, { teacherId });
      const name = teachers.find((t) => t.id === teacherId)?.name ?? "the teacher";
      showToast(`${name} now teaches ${course.name}.`);
      onChanged();
    } catch (err) {
      showToast(errorMessage(err, "Could not change the teacher. Please try again."), "error");
    } finally {
      setSavingId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api.delete(`/api/courses/${removing.id}`);
      showToast(`${removing.name} was removed.`);
      setRemoving(null);
      onChanged();
    } catch (err) {
      showToast(errorMessage(err, "Could not remove this subject. Please try again."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ud-section" aria-labelledby="ud-subjects">
      <SectionHeader
        title={<span id="ud-subjects">Subjects</span>}
        actions={
          canManage && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
              Add subject
            </button>
          )
        }
      />
      {unit.courses.length === 0 ? (
        <EmptyState
          title="No subjects yet. Add the subjects taught to this group, then build its timetable."
          action={
            canManage ? (
              <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
                Add subject
              </button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          caption={`Subjects for ${unit.name}`}
          rows={unit.courses}
          rowKey={(c) => c.id}
          columns={[
            {
              header: "Subject",
              primary: true,
              render: (c) => (
                <>
                  <Link to={`/dashboard/courses/${c.id}`}>{c.name}</Link>
                  {c.inherited && <span className="text-muted" style={{ fontSize: 12 }}> · from {c.orgUnit.name}</span>}
                </>
              ),
            },
            {
              header: "Teacher",
              render: (c) =>
                canManage ? (
                  <Select
                    aria-label={`Teacher for ${c.name}`}
                    value={c.teacher?.id ?? ""}
                    disabled={savingId === c.id || staff.loading}
                    onChange={(e) => changeTeacher(c, e.target.value)}
                    style={{ minWidth: 160 }}
                  >
                    {/* The API can't clear a teacher, only replace one. */}
                    <option value="" disabled>
                      Unassigned
                    </option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.role === "OWNER" ? " (owner)" : ""}
                      </option>
                    ))}
                  </Select>
                ) : (
                  (c.teacher?.name ?? <span className="text-muted">Unassigned</span>)
                ),
            },
            { header: "Taken by", render: (c) => (c.enrollmentMode === "SELECTED" ? "Selected students" : "Everyone") },
            {
              header: "",
              srHeader: "Actions",
              render: (c) =>
                canManage && !c.inherited ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-ghost-danger"
                    aria-label={`Remove subject ${c.name}`}
                    onClick={() => setRemoving(c)}
                  >
                    Remove
                  </button>
                ) : null,
            },
          ]}
        />
      )}
      {staff.error && canManage && (
        <p className="form-error" role="alert">
          Couldn&rsquo;t load the teacher list. {staff.error}
        </p>
      )}

      {addOpen && (
        <AddSubjectModal
          unit={unit}
          teachers={teachers}
          onClose={() => setAddOpen(false)}
          onAdded={(name) => {
            setAddOpen(false);
            showToast(`${name} was added to ${unit.name}.`);
            onChanged();
          }}
        />
      )}
      {removing && (
        <ConfirmModal
          title={`Remove ${removing.name}?`}
          body={`${removing.name} will be removed from ${unit.name}. Existing attendance records for it are kept, but it can no longer be timetabled.`}
          confirmLabel="Remove subject"
          variant="danger"
          busy={busy}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  );
}

function AddSubjectModal({
  unit,
  teachers,
  onClose,
  onAdded,
}: {
  unit: UnitDetail;
  teachers: StaffMember[];
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  const [form, setForm] = useState({ name: "", teacherId: "", enrollmentMode: "ALL_IN_UNIT" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFields({ name: "Enter a subject name." });
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.post("/api/courses", {
        orgUnitId: unit.id,
        name,
        teacherId: form.teacherId || undefined,
        enrollmentMode: form.enrollmentMode,
      });
      onAdded(name);
    } catch (err) {
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
      setError(errorMessage(err, "Could not add this subject. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Add a subject to ${unit.name}`}
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="add-subject-form" className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add subject"}
        </button>
      }
    >
      <form id="add-subject-form" onSubmit={submit}>
        <FormField label="Subject name" required error={fields.name}>
          <TextInput placeholder="e.g. Physics" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Teacher" error={fields.teacherId}>
          <Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
            <option value="">Unassigned</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.role === "OWNER" ? " (owner)" : ""}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Taken by" error={fields.enrollmentMode}>
          <Select value={form.enrollmentMode} onChange={(e) => setForm({ ...form, enrollmentMode: e.target.value })}>
            <option value="ALL_IN_UNIT">Everyone in this group</option>
            <option value="SELECTED">Selected students (elective)</option>
          </Select>
        </FormField>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function TimetableSection({ unit, slotsQuery, canManage }: { unit: UnitDetail; slotsQuery: SlotsResult; canManage: boolean }) {
  const showToast = useToast();
  const [slotModal, setSlotModal] = useState<{ slot: ScheduleSlot | null } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleting, setDeleting] = useState<ScheduleSlot | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/api/schedule/${deleting.id}`);
      showToast("Timetable slot deleted.");
      setDeleting(null);
      slotsQuery.reload();
    } catch (err) {
      showToast(errorMessage(err, "Could not delete this slot. Please try again."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ud-section" aria-labelledby="ud-timetable">
      <SectionHeader
        title={<span id="ud-timetable">Weekly timetable</span>}
        actions={
          canManage && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCopyOpen(true)}>
                Copy timetable from…
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setSlotModal({ slot: null })}>
                Add slot
              </button>
            </>
          )
        }
      />
      <AsyncState loading={slotsQuery.loading} error={slotsQuery.error} data={slotsQuery.data} onRetry={slotsQuery.reload}>
        {(slots) =>
          slots.length === 0 ? (
            <EmptyState
              title={
                canManage
                  ? "No weekly timetable yet. Add a slot, or copy the timetable of a similar group."
                  : "No weekly timetable has been set for this group."
              }
              action={
                canManage ? (
                  <div className="row">
                    <button type="button" className="btn btn-primary" onClick={() => setSlotModal({ slot: null })}>
                      Add slot
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setCopyOpen(true)}>
                      Copy timetable from…
                    </button>
                  </div>
                ) : undefined
              }
            />
          ) : (
            <div className="stack-lg">
              {DAY_ORDER.filter((day) => slots.some((s) => s.dayOfWeek === day)).map((day) => (
                <div key={day}>
                  <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>{WEEKDAYS[day]}</h3>
                  <div className="stack">
                    {slots
                      .filter((s) => s.dayOfWeek === day)
                      .map((slot) => (
                        <div key={slot.id} className="list-row">
                          <div>
                            <strong>{formatTimeRange(slot.startTime, slot.endTime)}</strong>
                            <span className="text-muted"> · {slot.course?.name ?? "Whole group (daily attendance)"}</span>
                          </div>
                          {canManage && (
                            <div className="row">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                aria-label={`Edit ${slotLabel(slot)}`}
                                onClick={() => setSlotModal({ slot })}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-ghost-danger"
                                aria-label={`Delete ${slotLabel(slot)}`}
                                onClick={() => setDeleting(slot)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </AsyncState>

      {slotModal && (
        <SlotModal
          unitId={unit.id}
          courses={unit.courses}
          slot={slotModal.slot}
          onClose={() => setSlotModal(null)}
          onSaved={(message) => {
            setSlotModal(null);
            showToast(message);
            slotsQuery.reload();
          }}
        />
      )}
      {copyOpen && (
        <CopyTimetableModal
          unit={unit}
          onClose={() => setCopyOpen(false)}
          onCopied={(message) => {
            setCopyOpen(false);
            showToast(message);
            slotsQuery.reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete this slot?"
          body={`${slotLabel(deleting)} will be removed from the weekly timetable. Sessions that were already generated from it are kept.`}
          confirmLabel="Delete slot"
          variant="danger"
          busy={busy}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

function SlotModal({
  unitId,
  courses,
  slot,
  onClose,
  onSaved,
}: {
  unitId: string;
  courses: CourseRow[];
  slot: ScheduleSlot | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const editing = slot !== null;
  const [days, setDays] = useState<number[]>(editing ? [slot.dayOfWeek] : [1]);
  const [startTime, setStartTime] = useState(slot?.startTime ?? "16:00");
  const [endTime, setEndTime] = useState(slot?.endTime ?? "17:00");
  const [courseId, setCourseId] = useState(slot?.course?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems: Record<string, string> = {};
    if (days.length === 0) problems.daysOfWeek = "Choose at least one day.";
    if (!startTime) problems.startTime = "Enter a start time.";
    if (!endTime) problems.endTime = "Enter an end time.";
    if (startTime && endTime && endTime <= startTime) problems.endTime = "The end time must be after the start time.";
    setFields(problems);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/api/schedule/${slot.id}`, { dayOfWeek: days[0], startTime, endTime, courseId: courseId || null });
        onSaved("Timetable slot updated.");
      } else {
        const created = await api.post<ScheduleSlot[]>(`/api/units/${unitId}/schedule`, {
          daysOfWeek: days,
          startTime,
          endTime,
          courseId: courseId || undefined,
        });
        onSaved(`${plural(created.length, "slot")} added to the timetable.`);
      }
    } catch (err) {
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
      setError(errorMessage(err, "Could not save this slot. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit timetable slot" : "Add timetable slot"}
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="slot-form" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Add slot"}
        </button>
      }
    >
      <form id="slot-form" onSubmit={submit}>
        {editing ? (
          <FormField label="Day" error={fields.dayOfWeek}>
            <Select value={String(days[0])} onChange={(e) => setDays([Number(e.target.value)])}>
              {DAY_ORDER.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAYS[d]}
                </option>
              ))}
            </Select>
          </FormField>
        ) : (
          <fieldset className="ud-fieldset" aria-describedby={fields.daysOfWeek ? "slot-days-error" : undefined}>
            <legend>
              Days <span aria-hidden="true" style={{ color: "var(--color-danger)" }}>*</span>
            </legend>
            <div className="ud-days">
              {DAY_ORDER.map((d) => (
                <label key={d} className="ud-check">
                  <input type="checkbox" checked={days.includes(d)} onChange={() => toggleDay(d)} />
                  {WEEKDAYS[d]}
                </label>
              ))}
            </div>
            <div className="row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDays([1, 2, 3, 4, 5])}>
                Mon–Fri
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDays([])}>
                Clear
              </button>
            </div>
            {(fields.daysOfWeek || fields.dayOfWeek) && (
              <p id="slot-days-error" className="form-error" role="alert">
                {fields.daysOfWeek ?? fields.dayOfWeek}
              </p>
            )}
          </fieldset>
        )}
        <div className="row" style={{ alignItems: "flex-start" }}>
          <FormField label="Starts" required error={fields.startTime}>
            <TextInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </FormField>
          <FormField label="Ends" required error={fields.endTime}>
            <TextInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </FormField>
        </div>
        <p className="sd-help" style={{ marginTop: -6, marginBottom: 14 }}>
          {startTime && endTime ? `Shown as ${formatTimeRange(startTime, endTime)}.` : "Pick a start and end time."}
        </p>
        <FormField label="Subject" error={fields.courseId}>
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Whole group (daily attendance)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function CopyTimetableModal({ unit, onClose, onCopied }: { unit: UnitDetail; onClose: () => void; onCopied: (message: string) => void }) {
  const [fromUnitId, setFromUnitId] = useState("");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromUnitId) {
      setError("Choose the group to copy the timetable from.");
      return;
    }
    if (fromUnitId === unit.id) {
      setError("Choose a different group to copy from.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ copied: number; skipped: number }>(`/api/units/${unit.id}/schedule/copy`, { fromUnitId, replace });
      const skipped = res.skipped > 0 ? ` ${plural(res.skipped, "slot")} for subjects this group doesn't take were skipped.` : "";
      onCopied(`${plural(res.copied, "slot")} copied.${skipped}`);
    } catch (err) {
      setError(errorMessage(err, "Could not copy the timetable. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Copy a timetable to ${unit.name}`}
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="copy-timetable-form" className="btn btn-primary" disabled={busy}>
          {busy ? "Copying…" : "Copy timetable"}
        </button>
      }
    >
      <form id="copy-timetable-form" onSubmit={submit}>
        <FormField label="Copy from" required>
          <GroupSelect value={fromUnitId} onChange={setFromUnitId} emptyLabel="Choose a group…" />
        </FormField>
        <label className="ud-check">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          <span>
            Replace the existing timetable
            <span className="sd-help" style={{ display: "block" }}>
              {replace
                ? `${unit.name}'s current slots will be deleted first.`
                : "Off: the copied slots are merged with what is already here; duplicates are skipped."}
            </span>
          </span>
        </label>
        <p className="sd-help">Slots for a subject that this group doesn&rsquo;t take are skipped. Sessions that already exist are not changed.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

// ─── Sessions & attendance ─────────────────────────────────────────────────

function SessionsTab({ unit, role }: { unit: UnitDetail; role: Role | null }) {
  const showToast = useToast();
  const isOwner = role === "OWNER";
  const rangeKey = `clazzo:unit-sessions-range:${unit.id}`;
  const defaultRange = useMemo(() => ({ from: isoDay(-7), to: isoDay(30) }), []);
  const [range, setRange] = useState(() => readStoredRange(rangeKey, defaultRange));
  const [generateOpen, setGenerateOpen] = useState(false);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [changing, setChanging] = useState<{ session: ClassSession; to: SessionStatus } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    storeRange(rangeKey, range);
  }, [rangeKey, range]);

  const rangeError = range.from && range.to && range.to < range.from ? "The end date must be on or after the start date." : null;
  const rangeReady = Boolean(range.from && range.to) && !rangeError;

  const sessions = useApiData<ClassSession[]>(
    () => (rangeReady ? api.get<ClassSession[]>(`/api/units/${unit.id}/sessions?from=${range.from}&to=${range.to}`) : Promise.resolve([])),
    [unit.id, range.from, range.to, rangeReady]
  );

  async function confirmChange() {
    if (!changing) return;
    setBusy(true);
    try {
      await api.patch(`/api/sessions/${changing.session.id}`, { status: changing.to });
      showToast(changing.to === "CANCELLED" ? "Session cancelled." : "Session restored.");
      setChanging(null);
      sessions.reload();
    } catch (err) {
      showToast(errorMessage(err, "Could not update this session. Please try again."), "error");
    } finally {
      setBusy(false);
    }
  }

  const isDefault = range.from === defaultRange.from && range.to === defaultRange.to;

  return (
    <section aria-labelledby="ud-sessions">
      <SectionHeader
        title={<span id="ud-sessions">Sessions &amp; attendance</span>}
        actions={
          isOwner && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHolidayOpen(true)}>
                Mark holiday
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setGenerateOpen(true)}>
                Generate sessions
              </button>
            </>
          )
        }
      />
      {role === "TEACHER" && <p className="sd-help" style={{ marginTop: 0 }}>You see only the sessions for subjects you teach.</p>}

      <div className="inline-form" style={{ marginTop: 0, marginBottom: 14 }}>
        <FormField label="From">
          <TextInput type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </FormField>
        <FormField label="To">
          <TextInput type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </FormField>
        <button type="button" className="btn btn-ghost btn-sm" disabled={isDefault} onClick={() => setRange(defaultRange)}>
          Reset to last week + next 30 days
        </button>
      </div>
      {rangeError && (
        <p className="form-error" role="alert">
          {rangeError}
        </p>
      )}

      <AsyncState loading={sessions.loading} error={sessions.error} data={sessions.data} onRetry={sessions.reload}>
        {(list) => {
          if (list.length === 0) {
            return (
              <EmptyState
                title={
                  isOwner
                    ? "No sessions in this date range. Set a weekly timetable, then generate sessions for the dates you need."
                    : "No sessions in this date range."
                }
                action={
                  isOwner ? (
                    <button type="button" className="btn btn-primary" onClick={() => setGenerateOpen(true)}>
                      Generate sessions
                    </button>
                  ) : undefined
                }
              />
            );
          }
          return (
            <>
              {list.length >= 200 && (
                <p className="banner banner-warning" style={{ marginBottom: 12 }}>
                  Only the first 200 sessions in this range are shown. Narrow the dates to see the rest.
                </p>
              )}
              <DataTable
                caption={`Sessions for ${unit.name}`}
                rows={list}
                rowKey={(s) => s.id}
                columns={[
                  { header: "Date", primary: true, render: (s) => formatWeekday(s.date) },
                  { header: "Time", render: (s) => formatTimeRange(s.startTime, s.endTime) },
                  { header: "Subject", render: (s) => s.course?.name ?? "Whole group" },
                  { header: "Status", render: (s) => <SessionStatusTag status={s.status} /> },
                  {
                    header: "Attendance",
                    render: (s) =>
                      s.status === "CANCELLED" ? (
                        <span className="text-muted">—</span>
                      ) : s._count.attendance > 0 ? (
                        <span className="tag tag-accent-2">Marked</span>
                      ) : (
                        <span className="tag tag-warning">Not marked</span>
                      ),
                  },
                  {
                    header: "",
                    srHeader: "Actions",
                    render: (s) => {
                      const subject = s.course?.name ?? "whole group";
                      const when = `${subject} on ${formatWeekday(s.date)}`;
                      const marked = s._count.attendance > 0;
                      return (
                        <div className="row">
                          {s.status !== "CANCELLED" && (
                            <Link
                              to={`/dashboard/attendance/${s.id}`}
                              className="btn btn-secondary btn-sm"
                              aria-label={`${marked ? "Edit" : "Mark"} attendance for ${when}`}
                            >
                              {marked ? "Edit attendance" : "Mark attendance"}
                            </Link>
                          )}
                          {s.status === "SCHEDULED" && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-ghost-danger"
                              aria-label={`Cancel session ${when}`}
                              onClick={() => setChanging({ session: s, to: "CANCELLED" })}
                            >
                              Cancel
                            </button>
                          )}
                          {s.status === "CANCELLED" && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-label={`Restore session ${when}`}
                              onClick={() => setChanging({ session: s, to: "SCHEDULED" })}
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      );
                    },
                  },
                ]}
              />
            </>
          );
        }}
      </AsyncState>

      {generateOpen && (
        <GenerateSessionsModal
          unit={unit}
          onClose={() => setGenerateOpen(false)}
          onGenerated={(created) => {
            setGenerateOpen(false);
            showToast(
              created > 0
                ? `${plural(created, "session")} created.`
                : "No new sessions were created. They may already exist, or the timetable has no slots in that range."
            );
            sessions.reload();
          }}
        />
      )}
      {holidayOpen && (
        <HolidayModal
          unit={unit}
          initialDate={isoDay(0)}
          onClose={() => setHolidayOpen(false)}
          onDone={(cancelled) => {
            setHolidayOpen(false);
            showToast(
              cancelled > 0
                ? `${plural(cancelled, "session")} cancelled for the holiday.`
                : "No sessions needed cancelling on that date."
            );
            sessions.reload();
          }}
        />
      )}
      {changing && (
        <ConfirmModal
          title={changing.to === "CANCELLED" ? "Cancel this session?" : "Restore this session?"}
          body={
            changing.to === "CANCELLED"
              ? `${changing.session.course?.name ?? "The whole-group class"} on ${formatWeekday(changing.session.date)} will be marked cancelled and left out of attendance reports.${
                  changing.session._count.attendance > 0 ? " Attendance has already been recorded for it, and it will stop counting." : ""
                }`
              : `${changing.session.course?.name ?? "The whole-group class"} on ${formatWeekday(changing.session.date)} will be scheduled again.`
          }
          confirmLabel={changing.to === "CANCELLED" ? "Cancel session" : "Restore session"}
          variant={changing.to === "CANCELLED" ? "danger" : "primary"}
          busy={busy}
          onConfirm={confirmChange}
          onClose={() => setChanging(null)}
        />
      )}
    </section>
  );
}

function GenerateSessionsModal({
  unit,
  onClose,
  onGenerated,
}: {
  unit: UnitDetail;
  onClose: () => void;
  onGenerated: (created: number) => void;
}) {
  const key = `clazzo:unit-generate-range:${unit.id}`;
  const [range, setRange] = useState(() => readStoredRange(key, { from: isoDay(0), to: isoDay(30) }));
  const [includeSubgroups, setIncludeSubgroups] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems: Record<string, string> = {};
    if (!range.from) problems.fromDate = "Choose a start date.";
    if (!range.to) problems.toDate = "Choose an end date.";
    if (range.from && range.to && range.to < range.from) problems.toDate = "The end date must be on or after the start date.";
    setFields(problems);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ created: number }>(`/api/units/${unit.id}/sessions/generate`, {
        fromDate: range.from,
        toDate: range.to,
        includeSubgroups: unit.children.length > 0 && includeSubgroups,
      });
      storeRange(key, range);
      onGenerated(res.created);
    } catch (err) {
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
      setError(errorMessage(err, "Could not generate sessions. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Generate sessions"
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="generate-sessions-form" className="btn btn-primary" disabled={busy}>
          {busy ? "Generating…" : "Generate sessions"}
        </button>
      }
    >
      <form id="generate-sessions-form" onSubmit={submit}>
        <p className="sd-help" style={{ marginTop: 0, marginBottom: 14 }}>
          Creates a session on every date in the range that matches a slot in the weekly timetable. Running it again never makes duplicates.
        </p>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <FormField label="From" required error={fields.fromDate}>
            <TextInput type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </FormField>
          <FormField label="To" required error={fields.toDate}>
            <TextInput type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </FormField>
        </div>
        {unit.children.length > 0 && (
          <label className="ud-check">
            <input type="checkbox" checked={includeSubgroups} onChange={(e) => setIncludeSubgroups(e.target.checked)} />
            <span>
              Also generate for the groups inside {unit.name}
              <span className="sd-help" style={{ display: "block" }}>
                Uses each sub-group&rsquo;s own timetable ({unit.children.map((c) => c.name).join(", ")} and anything inside them), so you can set up a whole class in one go.
              </span>
            </span>
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function HolidayModal({
  unit,
  initialDate,
  onClose,
  onDone,
}: {
  unit: UnitDetail;
  initialDate: string;
  onClose: () => void;
  onDone: (cancelled: number) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [scope, setScope] = useState<"unit" | "institute">("unit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setDateError("Choose the date of the holiday.");
      return;
    }
    setDateError(undefined);
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ cancelled: number }>("/api/sessions/holiday", {
        date,
        orgUnitId: scope === "unit" ? unit.id : undefined,
      });
      onDone(res.cancelled);
    } catch (err) {
      setError(errorMessage(err, "Could not mark the holiday. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Mark a holiday"
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="holiday-form" className="btn btn-primary" disabled={busy}>
          {busy ? "Marking…" : "Mark holiday"}
        </button>
      }
    >
      <form id="holiday-form" onSubmit={submit}>
        <p className="sd-help" style={{ marginTop: 0, marginBottom: 14 }}>
          Cancels every session still scheduled on that date, so they stop showing up as unmarked. Classes that already have attendance are left alone.
        </p>
        <FormField label="Date" required error={dateError}>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <FormField label="Applies to">
          <Select value={scope} onChange={(e) => setScope(e.target.value as "unit" | "institute")}>
            <option value="unit">{unit.name} and groups inside it</option>
            <option value="institute">The whole institute</option>
          </Select>
        </FormField>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

// ─── Fees ──────────────────────────────────────────────────────────────────

function FeesTab({
  unit,
  canEditStructure,
  onStructureChanged,
}: {
  unit: UnitDetail;
  canEditStructure: boolean;
  onStructureChanged: () => void;
}) {
  const showToast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const structure = unit.feeStructure;

  const invoices = useApiData<InvoiceList>(() => api.get<InvoiceList>(`/api/invoices?orgUnitId=${unit.id}&take=50`), [unit.id]);

  return (
    <div>
      <section className="ud-section" aria-labelledby="ud-fee-structure">
        <SectionHeader
          title={<span id="ud-fee-structure">Fee structure</span>}
          actions={
            canEditStructure && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditOpen(true)}>
                {structure ? "Edit fee structure" : "Set fee structure"}
              </button>
            )
          }
        />
        {structure ? (
          <div className="card card-md">
            <dl className="sd-dl">
              <dt>Amount</dt>
              <dd>{rupees(structure.amount)}</dd>
              <dt>Frequency</dt>
              <dd>{CYCLE_LABELS[structure.billingCycle]}</dd>
              <dt>Due on</dt>
              <dd>
                {structure.dueDayOfMonth !== null
                  ? `Day ${structure.dueDayOfMonth} of the month`
                  : `Day ${DEFAULT_DUE_DAY} of the month (default)`}
              </dd>
            </dl>
          </div>
        ) : (
          <EmptyState
            title={
              canEditStructure
                ? "No fee structure for this group. Set the amount to bill students automatically each month. A parent group's structure also applies here."
                : "No fee structure has been set for this group."
            }
            action={
              canEditStructure ? (
                <button type="button" className="btn btn-primary" onClick={() => setEditOpen(true)}>
                  Set fee structure
                </button>
              ) : undefined
            }
          />
        )}
      </section>

      <section className="ud-section" aria-labelledby="ud-invoices">
        <SectionHeader
          title={<span id="ud-invoices">Invoices</span>}
          actions={
            <>
              <Link to={`/dashboard/fees?orgUnitId=${unit.id}`} className="btn btn-secondary btn-sm">
                Open in Fees
              </Link>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setGenerateOpen(true)}>
                Generate invoices
              </button>
            </>
          }
        />
        <AsyncState loading={invoices.loading} error={invoices.error} data={invoices.data} onRetry={invoices.reload}>
          {(res) => (
            <div className="stack-lg">
              <div className="stat-grid" style={{ marginBottom: 0 }}>
                <StatCard label="Outstanding" value={rupees(res.summary.outstanding)} sentiment={Number(res.summary.outstanding) > 0 ? "neutral" : "good"} />
                <StatCard
                  label={`Overdue${res.summary.overdueCount > 0 ? ` (${res.summary.overdueCount})` : ""}`}
                  value={rupees(res.summary.overdue)}
                  sentiment={res.summary.overdueCount > 0 ? "bad" : "good"}
                />
                <StatCard label="Invoices" value={res.total} accent="accent-2" />
              </div>
              <DataTable
                caption={`Invoices for ${unit.name}`}
                rows={res.items}
                rowKey={(i) => i.id}
                emptyMessage="No invoices for this group yet. Use “Generate invoices” to bill a month for everyone in it."
                columns={[
                  { header: "Student", primary: true, render: (i) => <Link to={`/dashboard/students/${i.student.id}`}>{i.student.name}</Link> },
                  { header: "Due", render: (i) => formatDate(i.dueDate) },
                  { header: "Amount", render: (i) => rupees(i.amount) },
                  { header: "Paid", render: (i) => rupees(i.payments.reduce((sum, p) => sum + Number(p.amount), 0)) },
                  { header: "Status", render: (i) => <InvoiceStatusTag status={i.status} /> },
                ]}
              />
              {res.total > res.items.length && (
                <p className="text-muted" style={{ margin: 0 }}>
                  Showing the first {res.items.length} of {res.total} invoices.{" "}
                  <Link to={`/dashboard/fees?orgUnitId=${unit.id}`}>See all in Fees</Link>
                </p>
              )}
            </div>
          )}
        </AsyncState>
      </section>

      {editOpen && (
        <FeeStructureModal
          unit={unit}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            showToast("Fee structure saved.");
            onStructureChanged();
          }}
        />
      )}
      {generateOpen && (
        <GenerateInvoicesModal
          unit={unit}
          onClose={() => setGenerateOpen(false)}
          onGenerated={(created, period) => {
            setGenerateOpen(false);
            showToast(`${plural(created, "invoice")} created for ${period}.`);
            invoices.reload();
          }}
        />
      )}
    </div>
  );
}

function FeeStructureModal({ unit, onClose, onSaved }: { unit: UnitDetail; onClose: () => void; onSaved: () => void }) {
  const structure = unit.feeStructure;
  const [amount, setAmount] = useState(structure ? String(Number(structure.amount)) : "");
  const [billingCycle, setBillingCycle] = useState<string>(structure?.billingCycle ?? "MONTHLY");
  const [dueDay, setDueDay] = useState(structure?.dueDayOfMonth != null ? String(structure.dueDayOfMonth) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems: Record<string, string> = {};
    if (!(Number(amount) > 0)) problems.amount = "Enter an amount greater than 0.";
    if (dueDay !== "" && !(Number.isInteger(Number(dueDay)) && Number(dueDay) >= 1 && Number(dueDay) <= 28)) {
      problems.dueDayOfMonth = "Enter a day between 1 and 28.";
    }
    setFields(problems);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/units/${unit.id}/fee-structure`, {
        amount: Number(amount),
        billingCycle,
        dueDayOfMonth: dueDay === "" ? null : Number(dueDay),
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
      setError(errorMessage(err, "Could not save the fee structure. Please try again."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={structure ? "Edit fee structure" : "Set fee structure"}
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="fee-structure-form" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <form id="fee-structure-form" onSubmit={submit}>
        <FormField label="Amount (₹)" required error={fields.amount}>
          <TextInput type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <FormField label="Frequency" error={fields.billingCycle}>
          <Select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
            <option value="ONE_TIME">One-time</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
          </Select>
        </FormField>
        <FormField label="Due day of the month (optional)" error={fields.dueDayOfMonth}>
          <TextInput type="number" min="1" max="28" step="1" inputMode="numeric" placeholder={String(DEFAULT_DUE_DAY)} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </FormField>
        <p className="sd-help" style={{ marginTop: -6 }}>
          Invoices generated for this group fall due on this day (1 to 28). Leave it blank to use day {DEFAULT_DUE_DAY}.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function GenerateInvoicesModal({
  unit,
  onClose,
  onGenerated,
}: {
  unit: UnitDetail;
  onClose: () => void;
  onGenerated: (created: number, period: string) => void;
}) {
  const [period, setPeriod] = useState(isoDay(0).slice(0, 7));
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodError, setPeriodError] = useState<string | undefined>();

  function changePeriod(value: string) {
    setPeriod(value);
    setPreview(null);
    setError(null);
  }

  async function run(dryRun: boolean): Promise<InvoicePreview | null> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      setPeriodError("Choose the month to bill.");
      return null;
    }
    setPeriodError(undefined);
    setBusy(true);
    setError(null);
    try {
      return await api.post<InvoicePreview>(`/api/units/${unit.id}/invoices/generate`, { period, dryRun });
    } catch (err) {
      setError(errorMessage(err, "Could not prepare the invoices. Please try again."));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(true);
    if (result) setPreview(result);
  }

  async function confirm() {
    const result = await run(false);
    if (result) onGenerated(result.created, result.period);
  }

  return (
    <Modal
      title="Generate invoices"
      onClose={onClose}
      busy={busy}
      actions={
        preview && preview.toCreate > 0 ? (
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>
            {busy ? "Creating…" : `Create ${plural(preview.toCreate, "invoice")}`}
          </button>
        ) : (
          <button type="submit" form="generate-invoices-form" className="btn btn-primary" disabled={busy}>
            {busy ? "Checking…" : preview ? "Check again" : "Preview"}
          </button>
        )
      }
    >
      <form id="generate-invoices-form" onSubmit={submit}>
        <p className="sd-help" style={{ marginTop: 0, marginBottom: 14 }}>
          Bills everyone in {unit.name} (and the groups inside it) for one month, using the group&rsquo;s fee structure. Students who already have an invoice
          for that month are skipped, so it is safe to run again after new admissions.
        </p>
        <FormField label="Month" required error={periodError}>
          <TextInput type="month" value={period} onChange={(e) => changePeriod(e.target.value)} />
        </FormField>
        {preview && (
          <div className="ud-preview" role="status">
            {preview.toCreate > 0 ? (
              <>
                <strong>
                  {plural(preview.toCreate, "invoice")} will be created for {preview.period}
                </strong>
                <span>
                  {rupees(preview.amountEach)} each, {rupees(preview.total)} in total, due {formatDate(preview.dueDate)}.
                </span>
              </>
            ) : (
              <strong>Nothing to create for {preview.period}.</strong>
            )}
            <span className="text-muted">
              {plural(preview.studentCount, "student")} in the group
              {preview.skipped > 0 ? `, ${preview.skipped} already invoiced and skipped` : ""}.
            </span>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
