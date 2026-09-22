import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";

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

  // Returns one row per actively-enrolled student, defaulting to null status
  // for students who haven't been marked yet this session.
  fastify.get("/sessions/:sessionId/attendance", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        batch: true,
        attendance: { include: { student: { select: { id: true, name: true } } } },
      },
    });
    if (!session || session.batch.instituteId !== request.user.instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }

    const enrolled = await prisma.enrollment.findMany({
      where: { batchId: session.batchId, status: "ACTIVE" },
      include: { student: { select: { id: true, name: true } } },
    });

    const marked = new Map(session.attendance.map((a) => [a.studentId, a] as const));

    return enrolled.map(({ student }) => ({
      studentId: student.id,
      studentName: student.name,
      status: marked.get(student.id)?.status ?? null,
      markedAt: marked.get(student.id)?.markedAt ?? null,
    }));
  });

  fastify.post("/sessions/:sessionId/attendance", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { records } = markAttendanceSchema.parse(request.body);

    const session = await prisma.classSession.findUnique({ where: { id: sessionId }, include: { batch: true } });
    if (!session || session.batch.instituteId !== request.user.instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }

    const staff = asStaff(request.user);

    const studentIds = records.map((r) => r.studentId);
    const validEnrollments = await prisma.enrollment.count({
      where: { batchId: session.batchId, status: "ACTIVE", studentId: { in: studentIds } },
    });
    if (validEnrollments !== studentIds.length) {
      return reply.code(400).send({ error: "One or more students are not actively enrolled in this batch" });
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

    return reply.send({ marked: records.length });
  });

  // A student's attendance history across all batches, for progress views.
  fastify.get("/students/:studentId/attendance", async (request, reply) => {
    const { studentId } = request.params as { studentId: string };

    const student = await prisma.student.findFirst({ where: { id: studentId, instituteId: request.user.instituteId } });
    if (!student) return reply.code(404).send({ error: "Not found" });

    return prisma.attendance.findMany({
      where: { studentId },
      include: { classSession: { include: { batch: { select: { id: true, name: true } } } } },
      orderBy: { classSession: { date: "desc" } },
    });
  });
}
