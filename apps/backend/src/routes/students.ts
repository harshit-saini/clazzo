import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff, resolveIdentityByEmail } from "../auth/identity.js";
import { sendInviteEmail } from "../email/resend.js";
import { issueConsentOtpForEmail } from "../auth/issueOtp.js";
import { isConsentRequestAllowed } from "../auth/rateLimit.js";
import { logAudit } from "../lib/audit.js";
import { sendConsentCodeFor, studentsForGuardian } from "../lib/consent.js";
import { withEffectiveStatus } from "../lib/invoices.js";
import { findOrgUnit, studentIdsVisibleToTeacher } from "../lib/orgStructure.js";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = z.preprocess(emptyToUndefined, z.string().trim().max(120).optional());
const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().email().transform((e) => e.toLowerCase()).optional()
);

const studentFields = {
  name: z.string().trim().min(1).max(120),
  phone: optionalText,
  guardianName: optionalText,
  guardianPhone: optionalText,
  guardianEmail: optionalEmail,
};

const createStudentSchema = z.object({
  ...studentFields,
  // Place the student straight into a group instead of a second trip to
  // the group's page to enrol them.
  orgUnitId: z.string().optional(),
});

const updateStudentSchema = z.object(studentFields).partial();

const bulkSchema = z.object({
  orgUnitId: z.string().optional(),
  // Preview: validate and report, write nothing.
  dryRun: z.boolean().default(false),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
});

const inviteSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  guardianEmail: z.string().email().transform((e) => e.toLowerCase()).optional(),
});

export default async function studentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  // Filtering by orgUnitId includes students in that unit's descendants, so
  // asking for "Class 12" returns everyone in 12A and 12B too. Paginated
  // (default 50, max 500 per page) so a large roster can't come back as one
  // unbounded response. A TEACHER never sees the whole institute's roster —
  // only students on a course they're actually assigned to teach.
  fastify.get("/", async (request, reply) => {
    const staffMe = asStaff(request.user);
    const { instituteId } = staffMe;
    const { orgUnitId, search, take: takeRaw, skip: skipRaw } = request.query as {
      orgUnitId?: string;
      search?: string;
      take?: string;
      skip?: string;
    };
    const take = Math.min(Math.max(Number.parseInt(takeRaw ?? "", 10) || 50, 1), 500);
    const skip = Math.max(Number.parseInt(skipRaw ?? "", 10) || 0, 0);

    let unitPath: string | undefined;
    if (orgUnitId) {
      const unit = await findOrgUnit(orgUnitId, instituteId);
      if (!unit) return reply.code(404).send({ error: "Group not found" });
      unitPath = unit.path;
    }

    const visibleIds =
      staffMe.role === "TEACHER" ? await studentIdsVisibleToTeacher(staffMe.userId, instituteId) : null;

    const where = {
      instituteId,
      isActive: true,
      ...(unitPath
        ? { enrollments: { some: { status: "ACTIVE" as const, orgUnit: { path: { startsWith: unitPath } } } } }
        : {}),
      // A parent calling from their number should be findable, not only by
      // the child's name.
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
              { guardianName: { contains: search, mode: "insensitive" as const } },
              { guardianPhone: { contains: search } },
              { guardianEmail: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(visibleIds ? { id: { in: [...visibleIds] } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          guardianName: true,
          guardianPhone: true,
          guardianEmail: true,
          studentAccountId: true,
          consentStatus: true,
          invitedAt: true,
          createdAt: true,
          enrollments: {
            where: { status: "ACTIVE" },
            select: { orgUnit: { select: { id: true, name: true, depth: true } } },
          },
        },
        orderBy: { name: "asc" },
        take,
        skip,
      }),
      prisma.student.count({ where }),
    ]);

    return { items, total };
  });

  fastify.get("/:id", async (request, reply) => {
    const staffMe = asStaff(request.user);
    const { id } = request.params as { id: string };
    const student = await prisma.student.findFirst({
      where: { id, instituteId: staffMe.instituteId },
      include: {
        enrollments: { include: { orgUnit: true } },
        courseEnrollments: { include: { course: { select: { id: true, name: true } } } },
        invoices: { include: { payments: true }, orderBy: { dueDate: "desc" } },
      },
    });
    if (!student) return reply.code(404).send({ error: "Not found" });

    if (staffMe.role === "TEACHER") {
      const visibleIds = await studentIdsVisibleToTeacher(staffMe.userId, staffMe.instituteId);
      if (!visibleIds.has(student.id)) return reply.code(404).send({ error: "Not found" });
      // Fees are OWNER/ACCOUNTANT-only (see fees.ts) — don't leak them here.
      return { ...student, invoices: [] };
    }

    return { ...student, invoices: student.invoices.map((i) => withEffectiveStatus(i)) };
  });

  fastify.post("/", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const staff = asStaff(request.user);
    const { orgUnitId, ...fields } = createStudentSchema.parse(request.body);

    if (orgUnitId && !(await findOrgUnit(orgUnitId, staff.instituteId))) {
      return reply.code(404).send({ error: "Group not found" });
    }

    const student = await prisma.student.create({
      data: {
        instituteId: staff.instituteId,
        ...fields,
        ...(orgUnitId ? { enrollments: { create: { orgUnitId } } } : {}),
      },
    });

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "student.create",
      entityType: "Student",
      entityId: student.id,
      metadata: { name: student.name, orgUnitId: orgUnitId ?? null },
    });

    return reply.code(201).send(student);
  });

  // Paste-in import: accepts rows keyed by name/phone/guardianName/
  // guardianPhone/guardianEmail (header case and spacing are forgiven), and
  // reports every bad row by number rather than failing the whole batch.
  // With `dryRun` it validates and previews without writing anything.
  fastify.post("/bulk", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const staff = asStaff(request.user);
    const { rows, orgUnitId, dryRun } = bulkSchema.parse(request.body);

    if (orgUnitId && !(await findOrgUnit(orgUnitId, staff.instituteId))) {
      return reply.code(404).send({ error: "Group not found" });
    }

    const normalise = (row: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) out[k.toLowerCase().replace(/[^a-z]/g, "")] = v;
      return {
        name: out.name ?? out.studentname ?? out.fullname,
        phone: out.phone ?? out.mobile ?? out.studentphone,
        guardianName: out.guardianname ?? out.parentname ?? out.parent,
        guardianPhone: out.guardianphone ?? out.parentphone,
        guardianEmail: out.guardianemail ?? out.parentemail,
      };
    };

    const valid: z.infer<z.ZodObject<typeof studentFields>>[] = [];
    const errors: { row: number; error: string }[] = [];
    rows.forEach((raw, i) => {
      const parsed = z.object(studentFields).safeParse(normalise(raw));
      if (parsed.success) valid.push(parsed.data);
      else errors.push({ row: i + 1, error: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
    });

    if (dryRun || valid.length === 0) {
      return reply.send({ valid: valid.length, errors, created: 0 });
    }

    const created = await prisma.$transaction(
      valid.map((data) =>
        prisma.student.create({
          data: {
            instituteId: staff.instituteId,
            ...data,
            ...(orgUnitId ? { enrollments: { create: { orgUnitId } } } : {}),
          },
          select: { id: true },
        })
      )
    );

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "student.bulk_create",
      entityType: "Institute",
      entityId: staff.instituteId,
      metadata: { created: created.length, rejected: errors.length, orgUnitId: orgUnitId ?? null },
    });

    return reply.code(201).send({ valid: valid.length, errors, created: created.length });
  });

  fastify.patch("/:id", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const staff = asStaff(request.user);
    const { id } = request.params as { id: string };
    const body = updateStudentSchema.parse(request.body);

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

  fastify.delete("/:id", { preHandler: fastify.requireOwner }, async (request, reply) => {
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
  fastify.post("/:id/invite", { preHandler: fastify.requireOwner }, async (request, reply) => {
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
    let account = student.studentAccount;
    if (!accountId) {
      const existing = await resolveIdentityByEmail(email);
      if (existing?.kind === "STAFF") {
        return reply.code(409).send({ error: "An account with this email already exists" });
      }

      account =
        existing?.kind === "STUDENT"
          ? await prisma.studentAccount.findUniqueOrThrow({ where: { id: existing.studentAccountId } })
          : await prisma.studentAccount.create({ data: { name: student.name, email } });
      accountId = account.id;

      // One portal account maps to one student per institute — a second
      // sibling invited under the same email would collide (the portal
      // could only ever show one of them), so say so instead of linking.
      const sibling = await prisma.student.findFirst({
        where: { instituteId: staff.instituteId, studentAccountId: accountId, id: { not: id } },
        select: { name: true },
      });
      if (sibling) {
        return reply.code(409).send({
          error: `${email} is already linked to ${sibling.name} at this institute. Use a different email for ${student.name}.`,
        });
      }
    }

    // A student who declared themselves under 18 at signup carries their
    // guardian with them: consent is required even if staff left it blank.
    const effectiveGuardianEmail = guardianEmail ?? student.guardianEmail ?? account?.guardianEmail ?? undefined;
    const needsConsent = Boolean(effectiveGuardianEmail) && student.consentStatus !== "CONFIRMED";

    const institute = await prisma.institute.findUniqueOrThrow({ where: { id: staff.instituteId } });

    // Send before writing the DB state that describes "an email went out" —
    // otherwise a failed send (Resend down, bad API key) leaves the student
    // marked invited and/or consent-pending with nobody ever notified, and
    // the guardian-consent gate this app relies on for minors ends up in a
    // state that doesn't match reality. If either send throws, this request
    // 500s with no DB change, and re-running the invite is the correct retry.
    await sendInviteEmail(email, student.name, institute.name);
    if (needsConsent && effectiveGuardianEmail) {
      // One code covers every child awaiting this guardian, so name them all.
      const alsoAwaiting = (await studentsForGuardian(effectiveGuardianEmail, ["PENDING", "REVOKED"])).filter(
        (s) => s.id !== id
      );
      await issueConsentOtpForEmail(effectiveGuardianEmail, [
        { name: student.name, instituteName: institute.name },
        ...alsoAwaiting.map((s) => ({ name: s.name, instituteName: s.institute.name })),
      ]);
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        studentAccountId: accountId,
        invitedAt: new Date(),
        invitedById: staff.userId,
        guardianEmail: effectiveGuardianEmail,
        consentStatus: effectiveGuardianEmail ? (needsConsent ? "PENDING" : "CONFIRMED") : "NOT_REQUIRED",
        isMinor: account?.isMinor || Boolean(guardianEmail) || student.isMinor,
      },
    });

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

  // The guardian's code can lapse (and they have no account to log in and
  // ask for another), so staff can re-send it from the student's row.
  fastify.post("/:id/resend-consent", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const staff = asStaff(request.user);
    const { id } = request.params as { id: string };

    const student = await prisma.student.findFirst({ where: { id, instituteId: staff.instituteId } });
    if (!student) return reply.code(404).send({ error: "Not found" });
    if (!student.guardianEmail || !["PENDING", "REVOKED"].includes(student.consentStatus)) {
      return reply.code(409).send({ error: "This student isn't waiting on a guardian's consent" });
    }
    if (!isConsentRequestAllowed(student.guardianEmail)) {
      return reply.code(429).send({ error: "A code was just sent. Please wait a minute and try again." });
    }

    await sendConsentCodeFor(student.guardianEmail, ["PENDING", "REVOKED"]);

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "consent.resend",
      entityType: "Student",
      entityId: id,
    });

    return reply.send({ sentTo: student.guardianEmail });
  });
}
