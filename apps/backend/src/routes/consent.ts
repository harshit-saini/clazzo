import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifyOtpCode } from "../auth/verifyOtp.js";
import { logAudit } from "../lib/audit.js";

const confirmSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  code: z.string().length(6),
});

export default async function consentRoutes(fastify: FastifyInstance) {
  // A guardian confirms portal access for every PENDING Student membership
  // under their email in one shot — not authenticated (the guardian has no
  // account of their own), so the emailed code is what proves consent.
  fastify.post("/confirm", async (request, reply) => {
    const { email, code } = confirmSchema.parse(request.body);

    const result = await verifyOtpCode(email, code);
    if (!result.ok) return reply.code(401).send({ error: result.error });

    const pending = await prisma.student.findMany({
      where: { guardianEmail: email, consentStatus: "PENDING" },
    });

    if (pending.length === 0) {
      return reply.code(404).send({ error: "No pending consent requests found for this email" });
    }

    await prisma.student.updateMany({
      where: { id: { in: pending.map((s) => s.id) } },
      data: { consentStatus: "CONFIRMED", consentConfirmedAt: new Date() },
    });

    for (const student of pending) {
      await logAudit({
        actor: "SYSTEM",
        instituteId: student.instituteId,
        action: "consent.confirm",
        entityType: "Student",
        entityId: student.id,
        metadata: { guardianEmail: email },
      });
    }

    return reply.send({ confirmed: pending.map((s) => ({ studentId: s.id, instituteId: s.instituteId })) });
  });
}
