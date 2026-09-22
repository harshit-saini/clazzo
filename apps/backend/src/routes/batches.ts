import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { assertGradeInInstitute } from "../lib/grades.js";

const createBatchSchema = z.object({
  name: z.string().min(1),
  subject: z.string().optional(),
  description: z.string().optional(),
  primaryTeacherId: z.string().optional(),
  gradeId: z.string().optional(),
});

const updateBatchSchema = createBatchSchema.partial();

const enrollSchema = z.object({ studentId: z.string() });

export default async function batchRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  fastify.get("/", async (request) => {
    return prisma.batch.findMany({
      where: { instituteId: asStaff(request.user).instituteId, isActive: true },
      include: {
        primaryTeacher: { select: { id: true, name: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const batch = await prisma.batch.findFirst({
      where: { id, instituteId: asStaff(request.user).instituteId },
      include: {
        primaryTeacher: { select: { id: true, name: true } },
        scheduleSlots: true,
        feeStructure: true,
        enrollments: {
          where: { status: "ACTIVE" },
          include: { student: { select: { id: true, name: true, phone: true } } },
        },
      },
    });
    if (!batch) return reply.code(404).send({ error: "Not found" });
    return batch;
  });

  fastify.post("/", async (request, reply) => {
    const body = createBatchSchema.parse(request.body);
    await assertGradeInInstitute(body.gradeId, asStaff(request.user).instituteId);
    const batch = await prisma.batch.create({
      data: { instituteId: asStaff(request.user).instituteId, ...body },
    });
    return reply.code(201).send(batch);
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateBatchSchema.parse(request.body);
    await assertGradeInInstitute(body.gradeId, asStaff(request.user).instituteId);

    const existing = await prisma.batch.findFirst({ where: { id, instituteId: asStaff(request.user).instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    return prisma.batch.update({ where: { id }, data: body });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.batch.findFirst({ where: { id, instituteId: asStaff(request.user).instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    await prisma.batch.update({ where: { id }, data: { isActive: false } });
    return reply.code(204).send();
  });

  fastify.post("/:id/enroll", async (request, reply) => {
    const { id: batchId } = request.params as { id: string };
    const { studentId } = enrollSchema.parse(request.body);

    const [batch, student] = await Promise.all([
      prisma.batch.findFirst({ where: { id: batchId, instituteId: asStaff(request.user).instituteId } }),
      prisma.student.findFirst({ where: { id: studentId, instituteId: asStaff(request.user).instituteId } }),
    ]);
    if (!batch || !student) return reply.code(404).send({ error: "Batch or student not found" });

    const enrollment = await prisma.enrollment.upsert({
      where: { batchId_studentId: { batchId, studentId } },
      update: { status: "ACTIVE" },
      create: { batchId, studentId, status: "ACTIVE" },
    });

    return reply.code(201).send(enrollment);
  });

  fastify.delete("/:id/enroll/:studentId", async (request, reply) => {
    const { id: batchId, studentId } = request.params as { id: string; studentId: string };

    const batch = await prisma.batch.findFirst({ where: { id: batchId, instituteId: asStaff(request.user).instituteId } });
    if (!batch) return reply.code(404).send({ error: "Not found" });

    await prisma.enrollment.updateMany({
      where: { batchId, studentId },
      data: { status: "DROPPED" },
    });

    return reply.code(204).send();
  });
}
