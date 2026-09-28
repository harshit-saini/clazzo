import { Prisma, type FeePayment } from "@prisma/client";
import { prisma } from "../db.js";

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
