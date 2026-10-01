import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { logAudit } from "../lib/audit.js";

const updateInstituteSchema = z.object({ name: z.string().trim().min(1).max(120) });

export default async function instituteRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  fastify.get("/", async (request) => {
    const { instituteId } = asStaff(request.user);
    return prisma.institute.findUniqueOrThrow({
      where: { id: instituteId },
      select: { id: true, name: true, type: true },
    });
  });

  // Fixes the name typed at signup. Owner-only — it's printed on every
  // invite and consent email.
  fastify.patch("/", { preHandler: fastify.requireOwner }, async (request) => {
    const staff = asStaff(request.user);
    const { name } = updateInstituteSchema.parse(request.body);

    const institute = await prisma.institute.update({
      where: { id: staff.instituteId },
      data: { name },
      select: { id: true, name: true, type: true },
    });

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "institute.rename",
      entityType: "Institute",
      entityId: staff.instituteId,
      metadata: { name },
    });

    return institute;
  });
}
