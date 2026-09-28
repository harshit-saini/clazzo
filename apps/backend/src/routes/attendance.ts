import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { logAudit } from "../lib/audit.js";
import { rosterForSession, studentIdsVisibleToTeacher } from "../lib/orgStructure.js";

const markAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string(),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      })
    )
    .min(1),
});

/// A TEACHER may only touch a session tied to a course they teach.
/// Course-less (homeroom/daily-attendance) sessions have no per-teacher
/// owner in the schema — until a unit-level teacher assignment exists,
/// only OWNER can mark/view those rather than opening them to every
/// teacher institute-wide.
function staffCanAccessSession(
  staff: { role: string; userId: string },
  session: { course: { teacherId: string | null } | null }
): boolean {
  if (staff.role === "OWNER") return true;
  if (staff.role !== "TEACHER") return false;
  return session.course?.teacherId === staff.userId;
}

export default async function attendanceRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  // Returns one row per student on the session's roster, defaulting to null
  // status for students who haven't been marked yet this session. The roster
  // is the subject's students when the session has a course, otherwise
  // everyone in the group (daily/homeroom attendance).
  fastify.get("/sessions/:sessionId/attendance", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const staff = asStaff(request.user);

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        orgUnit: true,
        course: { select: { id: true, name: true, teacherId: true } },
        attendance: true,
      },
    });
    if (!session || session.orgUnit.instituteId !== staff.instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }
    if (!staffCanAccessSession(staff, session)) {
      return reply.code(403).send({ error: "You don't teach this class" });
    }

    const roster = await rosterForSession(session);
    const marked = new Map(session.attendance.map((a) => [a.studentId, a] as const));

    return {
      session: {
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        orgUnit: { id: session.orgUnit.id, name: session.orgUnit.name },
        course: session.course ? { id: session.course.id, name: session.course.name } : null,
      },
      roster: roster.map((student) => ({
        studentId: student.id,
        studentName: student.name,
        status: marked.get(student.id)?.status ?? null,
        markedAt: marked.get(student.id)?.markedAt ?? null,
      })),
    };
  });

  fastify.post("/sessions/:sessionId/attendance", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { records } = markAttendanceSchema.parse(request.body);

    const staff = asStaff(request.user);
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { orgUnit: true, course: { select: { teacherId: true } } },
    });
    if (!session || session.orgUnit.instituteId !== staff.instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }
    if (!staffCanAccessSession(staff, session)) {
      return reply.code(403).send({ error: "You don't teach this class" });
    }

    const roster = await rosterForSession(session);
    const rosterIds = new Set(roster.map((s) => s.id));
    if (records.some((r) => !rosterIds.has(r.studentId))) {
      return reply.code(400).send({ error: "One or more students are not on this session's roster" });
    }

    await prisma.$transaction(
      records.map((record) =>
        prisma.attendance.upsert({
          where: { classSessionId_studentId: { classSessionId: sessionId, studentId: record.studentId } },
          update: { status: record.status, markedById: staff.userId, markedAt: new Date() },
          create: {
            classSessionId: sessionId,
            studentId: record.studentId,
            status: record.status,
            markedById: staff.userId,
          },
        })
      )
    );

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "attendance.mark",
      entityType: "ClassSession",
      entityId: sessionId,
      metadata: { count: records.length, statuses: records.map((r) => r.status) },
    });

    return reply.send({ marked: records.length });
  });

  // A student's attendance history across every group and subject. A
  // TEACHER only gets this for a student on the roster of a course they
  // teach. Paginated (default 50, max 500) so a student's history can't
  // grow into an unbounded response over multiple terms.
  fastify.get("/students/:studentId/attendance", async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const staff = asStaff(request.user);
    const { take: takeRaw, skip: skipRaw } = request.query as { take?: string; skip?: string };
    const take = Math.min(Math.max(Number.parseInt(takeRaw ?? "", 10) || 50, 1), 500);
    const skip = Math.max(Number.parseInt(skipRaw ?? "", 10) || 0, 0);

    const student = await prisma.student.findFirst({
      where: { id: studentId, instituteId: staff.instituteId },
    });
    if (!student) return reply.code(404).send({ error: "Not found" });

    if (staff.role === "TEACHER") {
      const visibleIds = await studentIdsVisibleToTeacher(staff.userId, staff.instituteId);
      if (!visibleIds.has(studentId)) return reply.code(404).send({ error: "Not found" });
    }

    const where = { studentId };
    const [items, total] = await Promise.all([
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
    ]);

    return { items, total };
  });
}
