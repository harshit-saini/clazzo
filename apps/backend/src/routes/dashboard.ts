import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { toDateOnly } from "../lib/dates.js";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  // Every ClassSession today across the institute's batches, with whether
  // attendance has been fully marked yet — the teacher/owner "what's on
  // today" home view.
  fastify.get("/today", async (request) => {
    const { instituteId } = asStaff(request.user);
    const today = toDateOnly(new Date());

    const sessions = await prisma.classSession.findMany({
      where: { date: today, batch: { instituteId } },
      include: {
        batch: { select: { id: true, name: true, subject: true, primaryTeacher: { select: { id: true, name: true } } } },
        attendance: { select: { studentId: true } },
      },
      orderBy: { startTime: "asc" },
    });

    const enrolledCounts = await prisma.enrollment.groupBy({
      by: ["batchId"],
      where: { status: "ACTIVE", batchId: { in: sessions.map((s) => s.batchId) } },
      _count: { _all: true },
    });
    const enrolledByBatch = new Map(enrolledCounts.map((e) => [e.batchId, e._count._all]));

    return sessions.map((s) => ({
      id: s.id,
      batch: s.batch,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      enrolledCount: enrolledByBatch.get(s.batchId) ?? 0,
      markedCount: s.attendance.length,
    }));
  });

  // Top-line numbers for the dashboard home screen.
  fastify.get("/summary", async (request) => {
    const { instituteId } = asStaff(request.user);
    const today = toDateOnly(new Date());
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const [activeStudentCount, activeBatchCount, todaysSessions, outstandingInvoices, collectedThisMonth] =
      await Promise.all([
        prisma.student.count({ where: { instituteId, isActive: true } }),
        prisma.batch.count({ where: { instituteId, isActive: true } }),
        prisma.classSession.findMany({
          where: { date: today, batch: { instituteId } },
          include: { attendance: { select: { studentId: true } }, batch: { select: { id: true } } },
        }),
        prisma.feeInvoice.findMany({
          where: { student: { instituteId }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
          include: { payments: true },
        }),
        prisma.feePayment.aggregate({
          where: { invoice: { student: { instituteId } }, paidAt: { gte: monthStart } },
          _sum: { amount: true },
        }),
      ]);

    const batchIds = [...new Set(todaysSessions.map((s) => s.batch.id))];
    const enrolledCounts = batchIds.length
      ? await prisma.enrollment.groupBy({
          by: ["batchId"],
          where: { status: "ACTIVE", batchId: { in: batchIds } },
          _count: { _all: true },
        })
      : [];
    const enrolledByBatch = new Map(enrolledCounts.map((e) => [e.batchId, e._count._all]));

    const unmarkedSessionCount = todaysSessions.filter(
      (s) => s.attendance.length < (enrolledByBatch.get(s.batch.id) ?? 0)
    ).length;

    const outstandingTotal = outstandingInvoices.reduce((sum, inv) => {
      const paid = inv.payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
      return sum.plus(Prisma.Decimal.max(inv.amount.minus(paid), 0));
    }, new Prisma.Decimal(0));

    return {
      activeStudentCount,
      activeBatchCount,
      todaysSessionCount: todaysSessions.length,
      unmarkedSessionCount,
      outstandingInvoiceCount: outstandingInvoices.length,
      outstandingInvoiceTotal: outstandingTotal.toFixed(2),
      collectedThisMonthTotal: (collectedThisMonth._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    };
  });
}
