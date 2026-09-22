import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff, resolveIdentityByEmail } from "../auth/identity.js";
import { sendStaffWelcomeEmail } from "../email/resend.js";

const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().transform((e) => e.toLowerCase()),
  role: z.enum(["OWNER", "TEACHER"]).default("TEACHER"),
});

export default async function staffRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  fastify.get("/", async (request) => {
    return prisma.user.findMany({
      where: { instituteId: asStaff(request.user).instituteId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  });

  fastify.post("/", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const me = asStaff(request.user);
    const body = createStaffSchema.parse(request.body);

    const existing = await resolveIdentityByEmail(body.email);
    if (existing) {
      return reply.code(409).send({ error: "An account with this email already exists" });
    }

    const institute = await prisma.institute.findUniqueOrThrow({ where: { id: me.instituteId } });
    const staff = await prisma.user.create({
      data: { instituteId: me.instituteId, name: body.name, email: body.email, role: body.role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    await sendStaffWelcomeEmail(staff.email, staff.name, institute.name);

    return reply.code(201).send(staff);
  });

  fastify.patch("/:id/deactivate", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const staff = await prisma.user.findFirst({ where: { id, instituteId: asStaff(request.user).instituteId } });
    if (!staff) return reply.code(404).send({ error: "Not found" });

    const updated = await prisma.user.update({ where: { id }, data: { isActive: false } });
    return { id: updated.id, isActive: updated.isActive };
  });
}
