import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff, resolveIdentityByEmail } from "../auth/identity.js";
import { sendInviteEmail } from "../email/resend.js";
import { issueConsentOtpForEmail } from "../auth/issueOtp.js";
import { assertGradeInInstitute } from "../lib/grades.js";
import { logAudit } from "../lib/audit.js";

const createStudentSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  gradeId: z.string().optional(),
});

const updateStudentSchema = createStudentSchema.partial();

const inviteSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  guardianEmail: z.string().email().transform((e) => e.toLowerCase()).optional(),
});

export default async function studentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  fastify.get("/", async (request) => {
    const { batchId, search } = request.query as { batchId?: string; search?: string };

    return prisma.student.findMany({
      where: {
        instituteId: asStaff(request.user).instituteId,
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
        guardianEmail: true,
        grade: { select: { id: true, name: true } },
        studentAccountId: true,
        consentStatus: true,
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
      where: { id, instituteId: asStaff(request.user).instituteId },
      include: {
        grade: true,
        enrollments: { include: { batch: true } },
        invoices: { include: { payments: true }, orderBy: { dueDate: "desc" } },
      },
    });
    if (!student) return reply.code(404).send({ error: "Not found" });
    return student;
  });

  fastify.post("/", async (request, reply) => {
    const staff = asStaff(request.user);
    const body = createStudentSchema.parse(request.body);
    await assertGradeInInstitute(body.gradeId, staff.instituteId);

    const student = await prisma.student.create({
      data: { instituteId: staff.instituteId, ...body },
    });

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "student.create",
      entityType: "Student",
      entityId: student.id,
      metadata: { name: student.name },
    });

    return reply.code(201).send(student);
  });

  fastify.patch("/:id", async (request, reply) => {
    const staff = asStaff(request.user);
    const { id } = request.params as { id: string };
    const body = updateStudentSchema.parse(request.body);
    await assertGradeInInstitute(body.gradeId, staff.instituteId);

    const existing = await prisma.student.findFirst({ where: { id, instituteId: staff.instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    const updated = await prisma.student.update({ where: { id }, data: body });

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "student.update",
      entityType: "Student",
      entityId: id,
      metadata: { fields: Object.keys(body) },
    });

    return updated;
  });

  fastify.delete("/:id", async (request, reply) => {
    const staff = asStaff(request.user);
    const { id } = request.params as { id: string };
    const existing = await prisma.student.findFirst({ where: { id, instituteId: staff.instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    await prisma.student.update({ where: { id }, data: { isActive: false } });

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "student.deactivate",
      entityType: "Student",
      entityId: id,
    });

    return reply.code(204).send();
  });

  // Grants the student passwordless portal access and emails them the news —
  // no separate "accept invite" step; their first OTP request activates it.
  // The email resolves-or-creates a global StudentAccount, so a student who
  // already has an account elsewhere (or signed up themselves) just gets
  // this institute linked onto it, rather than a duplicate identity.
  //
  // If a guardianEmail is on file (passed here, or previously saved), this
  // membership is gated PENDING until the guardian confirms via an emailed
  // code (POST /api/consent/confirm) — the roster row and staff-side
  // management are unaffected either way; only this student's own portal
  // visibility into this institute is gated.
  fastify.post("/:id/invite", async (request, reply) => {
    const staff = asStaff(request.user);
    const { id } = request.params as { id: string };
    const { email, guardianEmail } = inviteSchema.parse(request.body);

    const student = await prisma.student.findFirst({
      where: { id, instituteId: staff.instituteId },
      include: { studentAccount: true },
    });
    if (!student) return reply.code(404).send({ error: "Not found" });

    if (student.studentAccount && student.studentAccount.email !== email) {
      return reply.code(409).send({ error: "This student already has portal access under a different email" });
    }

    let accountId = student.studentAccountId;
    if (!accountId) {
      const existing = await resolveIdentityByEmail(email);
      if (existing?.kind === "STAFF") {
        return reply.code(409).send({ error: "An account with this email already exists" });
      }

      const account =
        existing?.kind === "STUDENT"
          ? await prisma.studentAccount.findUniqueOrThrow({ where: { id: existing.studentAccountId } })
          : await prisma.studentAccount.create({ data: { name: student.name, email } });
      accountId = account.id;
    }

    const effectiveGuardianEmail = guardianEmail ?? student.guardianEmail ?? undefined;
    const needsConsent = Boolean(effectiveGuardianEmail) && student.consentStatus !== "CONFIRMED";

    const institute = await prisma.institute.findUniqueOrThrow({ where: { id: staff.instituteId } });

    const updated = await prisma.student.update({
      where: { id },
      data: {
        studentAccountId: accountId,
        invitedAt: new Date(),
        invitedById: staff.userId,
        guardianEmail: effectiveGuardianEmail,
        consentStatus: effectiveGuardianEmail ? (needsConsent ? "PENDING" : "CONFIRMED") : "NOT_REQUIRED",
      },
    });

    await sendInviteEmail(email, student.name, institute.name);
    if (needsConsent && effectiveGuardianEmail) {
      await issueConsentOtpForEmail(effectiveGuardianEmail, student.name, institute.name);
    }

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "student.invite",
      entityType: "Student",
      entityId: id,
      metadata: { email, guardianEmail: effectiveGuardianEmail ?? null, consentStatus: updated.consentStatus },
    });

    return reply.send({
      id: updated.id,
      studentAccountId: updated.studentAccountId,
      invitedAt: updated.invitedAt,
      consentStatus: updated.consentStatus,
    });
  });
}
