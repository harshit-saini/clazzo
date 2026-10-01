import { Prisma, type FeePayment, type InvoiceStatus } from "@prisma/client";
import { prisma } from "../db.js";
import { toDateOnly } from "./dates.js";

type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Recomputes an invoice's status from the sum of its payments vs. its amount
 * and due date. Accepts a transaction client so callers that create a
 * payment and recalculate status in the same request can do both atomically.
 */
export async function recalculateInvoiceStatus(invoiceId: string, db: DbClient = prisma) {
  const invoice = await db.feeInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: true },
  });

  // A voided invoice stays voided no matter what payments/edits follow.
  if (invoice.status === "CANCELLED") return "CANCELLED" as const;

  const paid = invoice.payments.reduce(
    (sum: Prisma.Decimal, p: FeePayment) => sum.plus(p.amount),
    new Prisma.Decimal(0)
  );

  let status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  if (paid.gte(invoice.amount)) {
    status = "PAID";
  } else if (paid.gt(0)) {
    status = "PARTIAL";
  } else if (invoice.dueDate < new Date()) {
    status = "OVERDUE";
  } else {
    status = "PENDING";
  }

  if (status !== invoice.status) {
    await db.feeInvoice.update({ where: { id: invoiceId }, data: { status } });
  }

  return status;
}

/**
 * The stored `status` only changes when a payment is recorded, so an invoice
 * nobody has paid stays PENDING forever after its due date — the Overdue
 * filter, chips and tags then never showed the people who actually owe
 * money. Overdue is therefore decided at read time: anything still owing
 * (PENDING / PARTIAL / OVERDUE) whose due date is before today.
 */
export function isPastDue(invoice: { status: InvoiceStatus; dueDate: Date }, now = new Date()): boolean {
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") return false;
  return invoice.dueDate < toDateOnly(now);
}

export function withEffectiveStatus<T extends { status: InvoiceStatus; dueDate: Date }>(invoice: T, now = new Date()): T {
  return isPastDue(invoice, now) ? { ...invoice, status: "OVERDUE" as const } : invoice;
}

/** Prisma `where` fragment matching the effective status above, in the DB. */
export function effectiveStatusWhere(status: string, now = new Date()): Prisma.FeeInvoiceWhereInput {
  const today = toDateOnly(now);
  switch (status) {
    case "OVERDUE":
      return { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] }, dueDate: { lt: today } };
    case "PENDING":
      return { status: { in: ["PENDING", "OVERDUE"] }, dueDate: { gte: today } };
    case "PARTIAL":
      return { status: "PARTIAL", dueDate: { gte: today } };
    case "PAID":
      return { status: "PAID" };
    case "CANCELLED":
      return { status: "CANCELLED" };
    default:
      return {};
  }
}

export function remainingOf(invoice: { amount: Prisma.Decimal; payments: { amount: Prisma.Decimal }[] }): Prisma.Decimal {
  const paid = invoice.payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
  return Prisma.Decimal.max(invoice.amount.minus(paid), 0);
}
