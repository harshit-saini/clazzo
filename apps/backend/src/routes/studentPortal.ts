import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { asStudent } from "../auth/identity.js";
import { lineageIds } from "../lib/orgStructure.js";
import { isPastDue, remainingOf, withEffectiveStatus } from "../lib/invoices.js";
import { toDateOnly } from "../lib/dates.js";

/// A membership the student can't use yet: waiting on the guardian's first
/// confirmation, or the guardian has since withdrawn it.
const isGated = (status: string) => status === "PENDING" || status === "REVOKED";

/// "alex.parent@gmail.com" -> "a•••@gmail.com": enough for a student to
/// recognise which inbox to ask, without handing the address to anyone who
/// borrows their phone.
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return null;
  return `${local.slice(0, 1)}•••@${domain}`;
}

/// Subjects a student actually takes at one institute: every course
/// attached to a unit they're enrolled in or any of its ancestors (so a
/// subject set on "Class 12" reaches a student sitting in 12A), minus the
/// electives they haven't opted into.
async function coursesForStudent(studentId: string, units: { path: string }[]) {
  const applicableUnitIds = [...new Set(units.flatMap((u) => lineageIds(u.path)))];
  if (applicableUnitIds.length === 0) return [];

  const [courses, electivePicks] = await Promise.all([
    prisma.course.findMany({
      where: { orgUnitId: { in: applicableUnitIds }, isActive: true },
      include: {
        teacher: { select: { id: true, name: true } },
        orgUnit: { select: { id: true, name: true } },
        scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      },
      orderBy: { name: "asc" },
    }),
    prisma.courseEnrollment.findMany({ where: { studentId }, select: { courseId: true } }),
  ]);

  const optedIn = new Set(electivePicks.map((p) => p.courseId));
  return courses.filter((c) => c.enrollmentMode !== "SELECTED" || optedIn.has(c.id));
}

export default async function studentPortalRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStudent);

  // The organizations (schools/colleges/coaching centers) this student
  // belongs to.
  fastify.get("/institutes", async (request) => {
    const { studentAccountId } = asStudent(request.user);

    const memberships = await prisma.student.findMany({
      where: { studentAccountId, isActive: true },
      include: {
        institute: { select: { id: true, name: true, type: true } },
        enrollments: {
          where: { status: "ACTIVE" },
          include: { orgUnit: { select: { id: true, name: true, path: true } } },
        },
        invoices: { where: { status: { not: "CANCELLED" } }, include: { payments: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return Promise.all(
      memberships.map(async (m) => {
        const units = m.enrollments.map((e) => e.orgUnit);
        const gated = isGated(m.consentStatus);
        const courses = gated ? [] : await coursesForStudent(m.id, units);

        // At-a-glance "needs attention" numbers, so a parent doesn't have to
        // open every institute to find the overdue fee or the low attendance.
        let overdueAmount = "0.00";
        let attendancePercent: number | null = null;
        if (!gated) {
          const overdue = m.invoices.filter((inv) => isPastDue(inv));
          overdueAmount = overdue.reduce((sum, inv) => sum + Number(remainingOf(inv)), 0).toFixed(2);

          const rows = await prisma.attendance.findMany({
            where: { studentId: m.id, classSession: { status: { not: "CANCELLED" } } },
            select: { status: true },
          });
          if (rows.length > 0) {
            const present = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
            attendancePercent = Math.round((present / rows.length) * 100);
          }
        }

        return {
          institute: m.institute,
          groups: units.map((u) => ({ id: u.id, name: u.name })),
          activeCourseCount: courses.length,
          consentStatus: m.consentStatus,
          maskedGuardianEmail: gated ? maskEmail(m.guardianEmail) : null,
          overdueAmount,
          attendancePercent,
        };
      })
    );
  });

  // What's on in the next week across every institute (cancellations
  // included, so "no class Tuesday" is visible rather than a silent gap).
  fastify.get("/upcoming", async (request) => {
    const { studentAccountId } = asStudent(request.user);
    const today = toDateOnly(new Date());
    const until = new Date(today);
    until.setUTCDate(until.getUTCDate() + 7);

    const memberships = await prisma.student.findMany({
      where: { studentAccountId, isActive: true, consentStatus: { notIn: ["PENDING", "REVOKED"] } },
      include: {
        institute: { select: { id: true, name: true } },
        enrollments: { where: { status: "ACTIVE" }, include: { orgUnit: { select: { path: true } } } },
        courseEnrollments: { select: { courseId: true } },
      },
    });

    const perMembership = await Promise.all(
      memberships.map(async (m) => {
        // A session belongs to a unit; it reaches a student sitting in that
        // unit or anywhere inside it — i.e. the session's unit is on the
        // lineage of one of the student's units.
        const unitIds = [...new Set(m.enrollments.flatMap((e) => lineageIds(e.orgUnit.path)))];
        if (unitIds.length === 0) return [];

        const optedIn = new Set(m.courseEnrollments.map((c) => c.courseId));
        const sessions = await prisma.classSession.findMany({
          where: { orgUnitId: { in: unitIds }, date: { gte: today, lt: until } },
          include: {
            orgUnit: { select: { name: true } },
            course: { select: { id: true, name: true, enrollmentMode: true, teacher: { select: { name: true } } } },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        });

        return sessions
          .filter((s) => !s.course || s.course.enrollmentMode !== "SELECTED" || optedIn.has(s.course.id))
          .map((s) => ({
            id: s.id,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            status: s.status,
            subject: s.course?.name ?? "Class",
            teacher: s.course?.teacher?.name ?? null,
            group: s.orgUnit.name,
            institute: m.institute,
          }));
      })
    );

    return perMembership
      .flat()
      .sort((a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime));
  });

  // Drill into one institute: which group the student sits in, the subjects
  // they take (with teacher, schedule, and an attendance summary each), and
  // their fee/invoice status.
  fastify.get("/institutes/:instituteId", async (request, reply) => {
    const { studentAccountId } = asStudent(request.user);
    const { instituteId } = request.params as { instituteId: string };

    const membership = await prisma.student.findFirst({
      where: { studentAccountId, instituteId, isActive: true },
      include: {
        institute: { select: { id: true, name: true, type: true } },
        enrollments: {
          where: { status: "ACTIVE" },
          include: { orgUnit: { select: { id: true, name: true, path: true } } },
        },
        invoices: { where: { status: { not: "CANCELLED" } }, include: { payments: true }, orderBy: { dueDate: "desc" } },
      },
    });
    if (!membership) return reply.code(404).send({ error: "Not found" });

    const units = membership.enrollments.map((e) => e.orgUnit);

    if (isGated(membership.consentStatus)) {
      return reply.send({
        institute: membership.institute,
        groups: [],
        consentStatus: membership.consentStatus,
        maskedGuardianEmail: maskEmail(membership.guardianEmail),
        courses: [],
        invoices: [],
      });
    }

    // Label each group with its ancestors, so "A" reads as "Class 12 › A".
    const ancestorIds = [...new Set(units.flatMap((u) => lineageIds(u.path)))];
    const allUnits = await prisma.orgUnit.findMany({
      where: { id: { in: ancestorIds } },
      select: { id: true, name: true },
    });
    const unitNames = new Map(allUnits.map((u) => [u.id, u.name]));

    const courses = await coursesForStudent(membership.id, units);

    const attendanceRows = await prisma.attendance.findMany({
      where: { studentId: membership.id, classSession: { orgUnit: { instituteId } } },
      select: { status: true, classSession: { select: { courseId: true } } },
    });

    const attendanceByCourse = new Map<string, { present: number; total: number }>();
    for (const row of attendanceRows) {
      const key = row.classSession.courseId ?? "__unsubjected__";
      const entry = attendanceByCourse.get(key) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (row.status === "PRESENT" || row.status === "LATE") entry.present += 1;
      attendanceByCourse.set(key, entry);
    }

    return {
      institute: membership.institute,
      groups: units.map((u) => ({
        id: u.id,
        name: u.name,
        breadcrumb: lineageIds(u.path).map((id) => unitNames.get(id) ?? "?"),
      })),
      consentStatus: membership.consentStatus,
      courses: courses.map((c) => ({
        courseId: c.id,
        name: c.name,
        code: c.code,
        group: c.orgUnit,
        teacher: c.teacher,
        schedule: c.scheduleSlots,
        attendance: attendanceByCourse.get(c.id) ?? { present: 0, total: 0 },
      })),
      invoices: membership.invoices.map((i) => withEffectiveStatus(i)),
    };
  });

  // Attendance history at one institute: paginated, and filterable by
  // subject and month so it stays usable after a full term.
  fastify.get("/institutes/:instituteId/attendance", async (request, reply) => {
    const { studentAccountId } = asStudent(request.user);
    const { instituteId } = request.params as { instituteId: string };
    const q = request.query as { courseId?: string; month?: string; take?: string; skip?: string };
    const take = Math.min(Math.max(Number.parseInt(q.take ?? "", 10) || 30, 1), 200);
    const skip = Math.max(Number.parseInt(q.skip ?? "", 10) || 0, 0);

    const membership = await prisma.student.findFirst({ where: { studentAccountId, instituteId, isActive: true } });
    if (!membership) return reply.code(404).send({ error: "Not found" });
    if (isGated(membership.consentStatus)) {
      return reply.code(403).send({ error: "Access pending guardian confirmation", code: "CONSENT_PENDING" });
    }

    let dateFilter = {};
    if (q.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month)) {
      const [y, m] = q.month.split("-").map(Number);
      dateFilter = { date: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } };
    }

    const where = {
      studentId: membership.id,
      classSession: {
        orgUnit: { instituteId },
        status: { not: "CANCELLED" as const },
        ...(q.courseId ? { courseId: q.courseId } : {}),
        ...dateFilter,
      },
    };

    const [items, total, subjectRows] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          classSession: {
            include: {
              orgUnit: { select: { id: true, name: true } },
              course: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { classSession: { date: "desc" } },
        take,
        skip,
      }),
      prisma.attendance.count({ where }),
      // Distinct subjects, to populate the filter regardless of the current filter.
      prisma.classSession.findMany({
        where: { attendance: { some: { studentId: membership.id } }, courseId: { not: null }, orgUnit: { instituteId } },
        distinct: ["courseId"],
        select: { course: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      items,
      total,
      subjects: subjectRows.map((r) => r.course).filter(Boolean),
    };
  });
}
