import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { recalculateInvoiceStatus } from "../lib/invoices.js";
import { asStaff } from "../auth/identity.js";
import { logAudit } from "../lib/audit.js";
import { findOrgUnit } from "../lib/orgStructure.js";

const feeStructureSchema = z.object({
  amount: z.coerce.number().positive(),
  billingCycle: z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY"]).default("MONTHLY"),
  dueDayOfMonth: z.number().int().min(1).max(28).optional(),
});

const createInvoiceSchema = z.object({
  orgUnitId: z.string().optional(),
  amount: z.coerce.number().positive(),
  dueDate: z.coerce.date(),
  notes: z.string().optional(),
});

const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE", "OTHER"]),
  paidAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export default async function feeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

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

  // ── Invoices ────────────────────────────────────────────────────────
  fastify.get("/invoices", async (request) => {
    const { status } = request.query as { status?: string };

    return prisma.feeInvoice.findMany({
      where: {
        student: { instituteId: asStaff(request.user).instituteId },
        ...(status ? { status: status as "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" } : {}),
      },
      include: {
        student: { select: { id: true, name: true } },
        payments: true,
      },
      orderBy: { dueDate: "asc" },
    });
  });

  fastify.get("/students/:studentId/invoices", async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const student = await prisma.student.findFirst({ where: { id: studentId, instituteId: asStaff(request.user).instituteId } });
    if (!student) return reply.code(404).send({ error: "Not found" });

    return prisma.feeInvoice.findMany({
      where: { studentId },
      include: { payments: true },
      orderBy: { dueDate: "desc" },
    });
  });

  fastify.post("/students/:studentId/invoices", async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const body = createInvoiceSchema.parse(request.body);

    const student = await prisma.student.findFirst({ where: { id: studentId, instituteId: asStaff(request.user).instituteId } });
    if (!student) return reply.code(404).send({ error: "Not found" });

    const invoice = await prisma.feeInvoice.create({
      data: { studentId, orgUnitId: body.orgUnitId, amount: body.amount, dueDate: body.dueDate, notes: body.notes },
    });

    return reply.code(201).send(invoice);
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

    const payment = await prisma.feePayment.create({
      data: {
        invoiceId,
        amount: body.amount,
        method: body.method,
        paidAt: body.paidAt,
        notes: body.notes,
        recordedById: staff.userId,
      },
    });

    const status = await recalculateInvoiceStatus(invoiceId);

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
