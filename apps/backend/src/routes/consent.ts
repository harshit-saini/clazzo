import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifyOtpCode } from "../auth/verifyOtp.js";
import { isConsentRequestAllowed } from "../auth/rateLimit.js";
import { logAudit } from "../lib/audit.js";
import { sendConsentCodeFor, studentsForGuardian } from "../lib/consent.js";

const emailSchema = z.string().email().transform((e) => e.toLowerCase());

const requestSchema = z.object({ email: emailSchema });

const confirmSchema = z.object({
  email: emailSchema,
  code: z.string().length(6),
});

const revokeSchema = confirmSchema.extend({
  // Omit to withdraw consent for every child under this guardian email.
  studentId: z.string().optional(),
});

const GENERIC_MESSAGE = "If that email is registered as a guardian, a code has been sent.";

export default async function consentRoutes(fastify: FastifyInstance) {
  // Guardians have no account, so they can't "log in" to ask for a fresh
  // code — this is their only way back when the emailed one has expired.
  // Same response whether or not the email is on file.
  fastify.post("/request", async (request, reply) => {
    const { email } = requestSchema.parse(request.body);

    if (!isConsentRequestAllowed(email)) {
      return reply.code(429).send({ error: "Too many requests. Please wait a minute and try again." });
    }

    await sendConsentCodeFor(email, ["PENDING", "CONFIRMED", "REVOKED"]);
    return reply.send({ message: GENERIC_MESSAGE });
  });

  // A guardian confirms portal access for every awaiting Student membership
  // under their email in one shot — not authenticated (the guardian has no
  // account of their own), so the emailed code is what proves consent. A
  // previously withdrawn consent can be given again the same way.
  fastify.post("/confirm", async (request, reply) => {
    const { email, code } = confirmSchema.parse(request.body);

    const result = await verifyOtpCode(email, code, "CONSENT");
    if (!result.ok) {
      return reply.code(401).send({ error: result.error, reason: result.reason, attemptsLeft: result.attemptsLeft });
    }

    const awaiting = await studentsForGuardian(email, ["PENDING", "REVOKED"]);
    if (awaiting.length === 0) {
      return reply.code(404).send({ error: "No pending consent requests found for this email" });
    }

    await prisma.student.updateMany({
      where: { id: { in: awaiting.map((s) => s.id) } },
      data: { consentStatus: "CONFIRMED", consentConfirmedAt: new Date(), consentRevokedAt: null },
    });

    for (const student of awaiting) {
      await logAudit({
        actor: "SYSTEM",
        instituteId: student.instituteId,
        action: "consent.confirm",
        entityType: "Student",
        entityId: student.id,
        metadata: { guardianEmail: email },
      });
    }

    return reply.send({
      confirmed: awaiting.map((s) => ({
        studentId: s.id,
        studentName: s.name,
        instituteId: s.instituteId,
        instituteName: s.institute.name,
      })),
    });
  });

  // Withdraws consent: the student's own portal access to that institute
  // switches off again (the school's roster record is unaffected).
  fastify.post("/revoke", async (request, reply) => {
    const { email, code, studentId } = revokeSchema.parse(request.body);

    const result = await verifyOtpCode(email, code, "CONSENT");
    if (!result.ok) {
      return reply.code(401).send({ error: result.error, reason: result.reason, attemptsLeft: result.attemptsLeft });
    }

    const confirmed = (await studentsForGuardian(email, ["CONFIRMED"])).filter((s) => !studentId || s.id === studentId);
    if (confirmed.length === 0) {
      return reply.code(404).send({ error: "No active consent found for this email" });
    }

    await prisma.student.updateMany({
      where: { id: { in: confirmed.map((s) => s.id) } },
      data: { consentStatus: "REVOKED", consentRevokedAt: new Date() },
    });

    for (const student of confirmed) {
      await logAudit({
        actor: "SYSTEM",
        instituteId: student.instituteId,
        action: "consent.revoke",
        entityType: "Student",
        entityId: student.id,
        metadata: { guardianEmail: email },
      });
    }

    return reply.send({
      revoked: confirmed.map((s) => ({ studentId: s.id, studentName: s.name, instituteName: s.institute.name })),
    });
  });
}
