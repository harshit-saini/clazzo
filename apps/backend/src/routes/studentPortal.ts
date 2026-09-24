import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { asStudent } from "../auth/identity.js";
import { lineageIds } from "../lib/orgStructure.js";

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
      },
      orderBy: { createdAt: "asc" },
    });

    return Promise.all(
      memberships.map(async (m) => {
        const units = m.enrollments.map((e) => e.orgUnit);
        const courses = m.consentStatus === "PENDING" ? [] : await coursesForStudent(m.id, units);
        return {
          institute: m.institute,
          groups: units.map((u) => ({ id: u.id, name: u.name })),
          activeCourseCount: courses.length,
          consentStatus: m.consentStatus,
        };
      })
    );
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
        invoices: { include: { payments: true }, orderBy: { dueDate: "desc" } },
      },
    });
    if (!membership) return reply.code(404).send({ error: "Not found" });

    const units = membership.enrollments.map((e) => e.orgUnit);

    if (membership.consentStatus === "PENDING") {
      return reply.send({
        institute: membership.institute,
        groups: [],
        consentStatus: "PENDING",
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
      invoices: membership.invoices,
    };
  });

  // Full attendance history at one institute, across all its subjects.
  fastify.get("/institutes/:instituteId/attendance", async (request, reply) => {
    const { studentAccountId } = asStudent(request.user);
    const { instituteId } = request.params as { instituteId: string };

    const membership = await prisma.student.findFirst({ where: { studentAccountId, instituteId, isActive: true } });
    if (!membership) return reply.code(404).send({ error: "Not found" });
    if (membership.consentStatus === "PENDING") {
      return reply.code(403).send({ error: "Access pending guardian confirmation" });
    }

    return prisma.attendance.findMany({
      where: { studentId: membership.id, classSession: { orgUnit: { instituteId } } },
      include: {
        classSession: {
          include: {
            orgUnit: { select: { id: true, name: true } },
            course: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { classSession: { date: "desc" } },
    });
  });
}
