import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  effectiveStatusWhere,
  recalculateInvoiceStatus,
  remainingOf,
  withEffectiveStatus,
  isPastDue,
} from "../lib/invoices.js";
import { asStaff } from "../auth/identity.js";
import { logAudit } from "../lib/audit.js";
import { findOrgUnit, lineageIds, rosterForUnit } from "../lib/orgStructure.js";

const feeStructureSchema = z.object({
  amount: z.coerce.number().positive(),
  billingCycle: z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY"]).default("MONTHLY"),
  dueDayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
});

const createInvoiceSchema = z.object({
  orgUnitId: z.string().optional(),
  amount: z.coerce.number().positive(),
  dueDate: z.coerce.date(),
  notes: z.string().optional(),
});

const updateInvoiceSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().nullable().optional(),
});

const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE", "OTHER"]),
  paidAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const generateSchema = z.object({
  /** "YYYY-MM" — which month these invoices are for. */
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM"),
  /** Overrides the fee structure's amount for this run. */
  amount: z.coerce.number().positive().optional(),
  /** Overrides the fee structure's due day (1–28) for this run. */
  dueDayOfMonth: z.number().int().min(1).max(28).optional(),
  /** Preview only: report what would happen and write nothing. */
  dryRun: z.boolean().default(false),
});

export default async function feeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  // Fee data is family financial information — narrower than "any staff
  // member," unlike the rest of the dashboard. A TEACHER has no reason to
  // see another section's (or their own students') outstanding dues.
  fastify.addHook("preHandler", fastify.requireOwnerOrAccountant);

  // ── Fee structure (per org unit) ───────────────────────────────────
  fastify.put("/units/:unitId/fee-structure", async (request, reply) => {
    const { unitId } = request.params as { unitId: string };
    const body = feeStructureSchema.parse(request.body);

    const unit = await findOrgUnit(unitId, asStaff(request.user).instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    const structure = await prisma.feeStructure.upsert({
      where: { orgUnitId: unitId },
      update: body,
      create: { orgUnitId: unitId, ...body },
    });

    return reply.send(structure);
  });

  fastify.get("/units/:unitId/fee-structure", async (request, reply) => {
    const { unitId } = request.params as { unitId: string };
    const unit = await findOrgUnit(unitId, asStaff(request.user).instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    const structure = await prisma.feeStructure.findUnique({ where: { orgUnitId: unitId } });
    return structure ?? reply.code(404).send({ error: "No fee structure set for this group" });
  });

  // Bills everyone in a group (and its sub-groups) for one month, using the
  // group's fee structure — or the nearest ancestor's. Re-running the same
  // month only bills students who don't already have an invoice for it, so
  // it's safe to repeat after new admissions. `dryRun` previews the result.
  fastify.post("/units/:unitId/invoices/generate", async (request, reply) => {
    const staff = asStaff(request.user);
    const { unitId } = request.params as { unitId: string };
    const body = generateSchema.parse(request.body);

    const unit = await findOrgUnit(unitId, staff.instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    const structures = await prisma.feeStructure.findMany({ where: { orgUnitId: { in: lineageIds(unit.path) } } });
    // Nearest wins: the deepest unit in the lineage that has a structure.
    const ordered = lineageIds(unit.path).reverse();
    const structure = ordered.map((id) => structures.find((s) => s.orgUnitId === id)).find(Boolean);

    const amount = body.amount ?? (structure ? Number(structure.amount) : undefined);
    if (!amount) {
      return reply.code(400).send({ error: "Set a fee amount for this group first, or enter one for this run" });
    }

    const [year, month] = body.period.split("-").map(Number);
    const dueDay = body.dueDayOfMonth ?? structure?.dueDayOfMonth ?? 5;
    const dueDate = new Date(Date.UTC(year, month - 1, dueDay));

    const roster = await rosterForUnit(unit);
    const already = await prisma.feeInvoice.findMany({
      where: {
        orgUnitId: unitId,
        period: body.period,
        status: { not: "CANCELLED" },
        studentId: { in: roster.map((s) => s.id) },
      },
      select: { studentId: true },
    });
    const alreadyIds = new Set(already.map((i) => i.studentId));
    const toBill = roster.filter((s) => !alreadyIds.has(s.id));

    const preview = {
      period: body.period,
      amountEach: amount.toFixed(2),
      dueDate,
      studentCount: roster.length,
      toCreate: toBill.length,
      skipped: roster.length - toBill.length,
      total: (amount * toBill.length).toFixed(2),
    };

    if (body.dryRun || toBill.length === 0) return reply.send({ ...preview, created: 0 });

    await prisma.feeInvoice.createMany({
      data: toBill.map((s) => ({
        studentId: s.id,
        orgUnitId: unitId,
        amount,
        dueDate,
        period: body.period,
      })),
    });

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "invoice.generate",
      entityType: "OrgUnit",
      entityId: unitId,
      metadata: { period: body.period, created: toBill.length, amount },
    });

    return reply.code(201).send({ ...preview, created: toBill.length });
  });

  // ── Invoices ────────────────────────────────────────────────────────
  // Filterable and paginated; `status` is the *effective* status, so
  // "OVERDUE" finds unpaid invoices past their due date even though nothing
  // has rewritten their stored status. `summary` covers every match, not
  // just the current page.
  fastify.get("/invoices", async (request, reply) => {
    const { instituteId } = asStaff(request.user);
    const q = request.query as {
      status?: string;
      orgUnitId?: string;
      from?: string;
      to?: string;
      search?: string;
      take?: string;
      skip?: string;
    };
    const take = Math.min(Math.max(Number.parseInt(q.take ?? "", 10) || 50, 1), 500);
    const skip = Math.max(Number.parseInt(q.skip ?? "", 10) || 0, 0);

    let unitPath: string | undefined;
    if (q.orgUnitId) {
      const unit = await findOrgUnit(q.orgUnitId, instituteId);
      if (!unit) return reply.code(404).send({ error: "Group not found" });
      unitPath = unit.path;
    }

    const where: Prisma.FeeInvoiceWhereInput = {
      AND: [
        {
          student: {
            instituteId,
            ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
          },
        },
        ...(unitPath ? [{ orgUnit: { path: { startsWith: unitPath } } }] : []),
        ...(q.from || q.to
          ? [{ dueDate: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }]
          : []),
        // Cancelled invoices only appear when explicitly asked for.
        q.status ? effectiveStatusWhere(q.status) : { status: { not: "CANCELLED" as const } },
      ],
    };

    const [rows, total, everyMatch] = await Promise.all([
      prisma.feeInvoice.findMany({
        where,
        include: { student: { select: { id: true, name: true } }, payments: true, orgUnit: { select: { id: true, name: true } } },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take,
        skip,
      }),
      prisma.feeInvoice.count({ where }),
      prisma.feeInvoice.findMany({
        where,
        select: { amount: true, status: true, dueDate: true, payments: { select: { amount: true } } },
      }),
    ]);

    let outstanding = new Prisma.Decimal(0);
    let overdue = new Prisma.Decimal(0);
    let overdueCount = 0;
    for (const inv of everyMatch) {
      if (inv.status === "PAID" || inv.status === "CANCELLED") continue;
      const left = remainingOf(inv);
      outstanding = outstanding.plus(left);
      if (isPastDue(inv)) {
        overdue = overdue.plus(left);
        overdueCount += 1;
      }
    }

    return {
      items: rows.map((r) => withEffectiveStatus(r)),
      total,
      summary: {
        outstanding: outstanding.toFixed(2),
        overdue: overdue.toFixed(2),
        overdueCount,
      },
    };
  });

  fastify.get("/students/:studentId/invoices", async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const student = await prisma.student.findFirst({ where: { id: studentId, instituteId: asStaff(request.user).instituteId } });
    if (!student) return reply.code(404).send({ error: "Not found" });

    const invoices = await prisma.feeInvoice.findMany({
      where: { studentId },
      include: { payments: true },
      orderBy: { dueDate: "desc" },
    });
    return invoices.map((i) => withEffectiveStatus(i));
  });

  fastify.post("/students/:studentId/invoices", async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const body = createInvoiceSchema.parse(request.body);

    const { instituteId } = asStaff(request.user);
    const student = await prisma.student.findFirst({ where: { id: studentId, instituteId } });
    if (!student) return reply.code(404).send({ error: "Not found" });

    if (body.orgUnitId && !(await findOrgUnit(body.orgUnitId, instituteId))) {
      return reply.code(404).send({ error: "Group not found" });
    }

    const invoice = await prisma.feeInvoice.create({
      data: { studentId, orgUnitId: body.orgUnitId, amount: body.amount, dueDate: body.dueDate, notes: body.notes },
    });

    return reply.code(201).send(invoice);
  });

  // Fix a typo in the amount/due date/notes. The amount can't drop below
  // what's already been paid — that would leave a negative balance.
  fastify.patch("/invoices/:invoiceId", async (request, reply) => {
    const staff = asStaff(request.user);
    const { invoiceId } = request.params as { invoiceId: string };
    const body = updateInvoiceSchema.parse(request.body);

    const invoice = await prisma.feeInvoice.findUnique({
      where: { id: invoiceId },
      include: { student: true, payments: true },
    });
    if (!invoice || invoice.student.instituteId !== staff.instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }
    if (invoice.status === "CANCELLED") {
      return reply.code(409).send({ error: "This invoice has been cancelled" });
    }

    const paid = invoice.payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
    if (body.amount !== undefined && paid.gt(body.amount)) {
      return reply.code(400).send({ error: `₹${paid.toFixed(2)} has already been paid, so the amount can't go below that` });
    }

    const status = await prisma.$transaction(async (tx) => {
      await tx.feeInvoice.update({
        where: { id: invoiceId },
        data: { amount: body.amount, dueDate: body.dueDate, notes: body.notes },
      });
      return recalculateInvoiceStatus(invoiceId, tx);
    });

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "invoice.update",
      entityType: "FeeInvoice",
      entityId: invoiceId,
      metadata: { fields: Object.keys(body), resultingStatus: status },
    });

    return reply.send({ id: invoiceId, status });
  });

  // Voids an invoice raised in error or waived. Refused once money has been
  // taken against it — refund/adjust that deliberately instead.
  fastify.post("/invoices/:invoiceId/cancel", async (request, reply) => {
    const staff = asStaff(request.user);
    const { invoiceId } = request.params as { invoiceId: string };

    const invoice = await prisma.feeInvoice.findUnique({
      where: { id: invoiceId },
      include: { student: true, payments: true },
    });
    if (!invoice || invoice.student.instituteId !== staff.instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }
    if (invoice.payments.length > 0) {
      return reply.code(409).send({ error: "Payments have been recorded against this invoice, so it can't be cancelled" });
    }

    await prisma.feeInvoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED" } });

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "invoice.cancel",
      entityType: "FeeInvoice",
      entityId: invoiceId,
    });

    return reply.send({ id: invoiceId, status: "CANCELLED" });
  });

  // ── Payments ────────────────────────────────────────────────────────
  fastify.post("/invoices/:invoiceId/payments", async (request, reply) => {
    const staff = asStaff(request.user);
    const { invoiceId } = request.params as { invoiceId: string };
    const body = recordPaymentSchema.parse(request.body);

    const invoice = await prisma.feeInvoice.findUnique({ where: { id: invoiceId }, include: { student: true } });
    if (!invoice || invoice.student.instituteId !== staff.instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }
    if (invoice.status === "CANCELLED") {
      return reply.code(409).send({ error: "This invoice has been cancelled" });
    }

    // Recording the payment and recalculating the invoice's status must
    // succeed or fail together — otherwise a crash between the two leaves a
    // real payment on record against a stale (still PENDING/PARTIAL) invoice.
    const { payment, status } = await prisma.$transaction(async (tx) => {
      const payment = await tx.feePayment.create({
        data: {
          invoiceId,
          amount: body.amount,
          method: body.method,
          paidAt: body.paidAt,
          notes: body.notes,
          recordedById: staff.userId,
        },
      });

      const status = await recalculateInvoiceStatus(invoiceId, tx);
      return { payment, status };
    });

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "payment.record",
      entityType: "FeeInvoice",
      entityId: invoiceId,
      metadata: { amount: body.amount, method: body.method, resultingStatus: status },
    });

    return reply.code(201).send({ payment, invoiceStatus: status });
  });
}
