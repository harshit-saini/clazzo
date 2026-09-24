import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { logAudit } from "../lib/audit.js";
import { rosterForSession } from "../lib/orgStructure.js";

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

export default async function attendanceRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  // Returns one row per student on the session's roster, defaulting to null
  // status for students who haven't been marked yet this session. The roster
  // is the subject's students when the session has a course, otherwise
  // everyone in the group (daily/homeroom attendance).
  fastify.get("/sessions/:sessionId/attendance", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        orgUnit: true,
        course: { select: { id: true, name: true } },
        attendance: true,
      },
    });
    if (!session || session.orgUnit.instituteId !== asStaff(request.user).instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }

    const roster = await rosterForSession(session);
    const marked = new Map(session.attendance.map((a) => [a.studentId, a] as const));

    return roster.map((student) => ({
      studentId: student.id,
      studentName: student.name,
      status: marked.get(student.id)?.status ?? null,
      markedAt: marked.get(student.id)?.markedAt ?? null,
    }));
  });

  fastify.post("/sessions/:sessionId/attendance", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { records } = markAttendanceSchema.parse(request.body);

    const staff = asStaff(request.user);
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { orgUnit: true },
    });
    if (!session || session.orgUnit.instituteId !== staff.instituteId) {
      return reply.code(404).send({ error: "Not found" });
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

  // A student's attendance history across every group and subject.
  fastify.get("/students/:studentId/attendance", async (request, reply) => {
    const { studentId } = request.params as { studentId: string };

    const student = await prisma.student.findFirst({
      where: { id: studentId, instituteId: asStaff(request.user).instituteId },
    });
    if (!student) return reply.code(404).send({ error: "Not found" });

    return prisma.attendance.findMany({
      where: { studentId },
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
