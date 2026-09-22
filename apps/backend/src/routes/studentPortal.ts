import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { asStudent } from "../auth/identity.js";

export default async function studentPortalRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStudent);

  // The organizations (schools/coaching centers) this student belongs to.
  fastify.get("/institutes", async (request) => {
    const { studentAccountId } = asStudent(request.user);

    const memberships = await prisma.student.findMany({
      where: { studentAccountId, isActive: true },
      include: {
        institute: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      institute: m.institute,
      grade: m.grade,
      activeCourseCount: m._count.enrollments,
    }));
  });

  // Drill into one institute: grade, enrolled courses (with teacher, schedule,
  // and an attendance summary per course), and fee/invoice status.
  fastify.get("/institutes/:instituteId", async (request, reply) => {
    const { studentAccountId } = asStudent(request.user);
    const { instituteId } = request.params as { instituteId: string };

    const membership = await prisma.student.findFirst({
      where: { studentAccountId, instituteId, isActive: true },
      include: {
        institute: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            batch: {
              include: {
                primaryTeacher: { select: { id: true, name: true } },
                scheduleSlots: true,
              },
            },
          },
        },
        invoices: { include: { payments: true }, orderBy: { dueDate: "desc" } },
      },
    });
    if (!membership) return reply.code(404).send({ error: "Not found" });

    const batchIds = membership.enrollments.map((e) => e.batchId);
    const attendanceRows = await prisma.attendance.findMany({
      where: { studentId: membership.id, classSession: { batchId: { in: batchIds } } },
      select: { status: true, classSession: { select: { batchId: true } } },
    });

    const attendanceByBatch = new Map<string, { present: number; total: number }>();
    for (const row of attendanceRows) {
      const key = row.classSession.batchId;
      const entry = attendanceByBatch.get(key) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (row.status === "PRESENT" || row.status === "LATE") entry.present += 1;
      attendanceByBatch.set(key, entry);
    }

    return {
      institute: membership.institute,
      grade: membership.grade,
      courses: membership.enrollments.map((e) => ({
        batchId: e.batch.id,
        name: e.batch.name,
        subject: e.batch.subject,
        teacher: e.batch.primaryTeacher,
        schedule: e.batch.scheduleSlots,
        attendance: attendanceByBatch.get(e.batch.id) ?? { present: 0, total: 0 },
      })),
      invoices: membership.invoices,
    };
  });

  // Full attendance history at one institute, across all its courses.
  fastify.get("/institutes/:instituteId/attendance", async (request, reply) => {
    const { studentAccountId } = asStudent(request.user);
    const { instituteId } = request.params as { instituteId: string };

    const membership = await prisma.student.findFirst({ where: { studentAccountId, instituteId, isActive: true } });
    if (!membership) return reply.code(404).send({ error: "Not found" });

    return prisma.attendance.findMany({
      where: { studentId: membership.id },
      include: { classSession: { include: { batch: { select: { id: true, name: true, subject: true } } } } },
      orderBy: { classSession: { date: "desc" } },
    });
  });
}
