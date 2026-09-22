import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff, resolveIdentityByEmail } from "../auth/identity.js";
import { sendInviteEmail } from "../email/resend.js";

const createStudentSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
});

const updateStudentSchema = createStudentSchema.partial();

const inviteSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
});

export default async function studentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

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
        invitedAt: true,
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
    return student;
  });

  fastify.post("/", async (request, reply) => {
    const body = createStudentSchema.parse(request.body);

    const student = await prisma.student.create({
      data: { instituteId: request.user.instituteId, ...body },
    });

    return reply.code(201).send(student);
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateStudentSchema.parse(request.body);

    const existing = await prisma.student.findFirst({ where: { id, instituteId: request.user.instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    return prisma.student.update({ where: { id }, data: body });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.student.findFirst({ where: { id, instituteId: request.user.instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    await prisma.student.update({ where: { id }, data: { isActive: false } });
    return reply.code(204).send();
  });

  // Grants the student passwordless portal access and emails them the news —
  // no separate "accept invite" step; their first OTP request activates it.
  fastify.post("/:id/invite", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { email } = inviteSchema.parse(request.body);

    const student = await prisma.student.findFirst({ where: { id, instituteId: request.user.instituteId } });
    if (!student) return reply.code(404).send({ error: "Not found" });

    if (student.portalEmail && student.portalEmail !== email) {
      return reply.code(409).send({ error: "This student already has portal access under a different email" });
    }

    const existing = await resolveIdentityByEmail(email);
    if (existing && !(existing.kind === "STUDENT" && existing.studentId === id)) {
      return reply.code(409).send({ error: "An account with this email already exists" });
    }

    const institute = await prisma.institute.findUniqueOrThrow({ where: { id: request.user.instituteId } });

    const updated = await prisma.student.update({
      where: { id },
      data: { portalEmail: email, invitedAt: new Date(), invitedById: asStaff(request.user).userId },
    });

    await sendInviteEmail(email, student.name, institute.name);

    return reply.send({ id: updated.id, portalEmail: updated.portalEmail, invitedAt: updated.invitedAt });
  });
}
