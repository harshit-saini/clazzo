import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword } from "../auth/password.js";

const createStudentSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  portalEmail: z.string().email().optional(),
  portalPassword: z.string().min(8).optional(),
});

const updateStudentSchema = createStudentSchema.partial();

export default async function studentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request) => {
    const { batchId, search } = request.query as { batchId?: string; search?: string };

    return prisma.student.findMany({
      where: {
        instituteId: request.user.instituteId,
        isActive: true,
        ...(batchId ? { enrollments: { some: { batchId, status: "ACTIVE" } } } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        guardianName: true,
        guardianPhone: true,
        portalEmail: true,
        createdAt: true,
        enrollments: {
          where: { status: "ACTIVE" },
          select: { batch: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const student = await prisma.student.findFirst({
      where: { id, instituteId: request.user.instituteId },
      include: {
        enrollments: { include: { batch: true } },
        invoices: { include: { payments: true }, orderBy: { dueDate: "desc" } },
      },
    });
    if (!student) return reply.code(404).send({ error: "Not found" });
    const { portalPasswordHash: _portalPasswordHash, ...safe } = student;
    return safe;
  });

  fastify.post("/", async (request, reply) => {
    const body = createStudentSchema.parse(request.body);

    if (body.portalEmail && !body.portalPassword) {
      return reply.code(400).send({ error: "portalPassword is required when portalEmail is set" });
    }

    const student = await prisma.student.create({
      data: {
        instituteId: request.user.instituteId,
        name: body.name,
        phone: body.phone,
        guardianName: body.guardianName,
        guardianPhone: body.guardianPhone,
        portalEmail: body.portalEmail,
        portalPasswordHash: body.portalPassword ? await hashPassword(body.portalPassword) : undefined,
      },
    });

    const { portalPasswordHash: _portalPasswordHash, ...safe } = student;
    return reply.code(201).send(safe);
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateStudentSchema.parse(request.body);

    const existing = await prisma.student.findFirst({ where: { id, instituteId: request.user.instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    const student = await prisma.student.update({
      where: { id },
      data: {
        name: body.name,
        phone: body.phone,
        guardianName: body.guardianName,
        guardianPhone: body.guardianPhone,
        portalEmail: body.portalEmail,
        portalPasswordHash: body.portalPassword ? await hashPassword(body.portalPassword) : undefined,
      },
    });

    const { portalPasswordHash: _portalPasswordHash, ...safe } = student;
    return safe;
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.student.findFirst({ where: { id, instituteId: request.user.instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    await prisma.student.update({ where: { id }, data: { isActive: false } });
    return reply.code(204).send();
  });
}
