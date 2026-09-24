import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { toDateOnly } from "../lib/dates.js";
import { rosterForSession } from "../lib/orgStructure.js";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  // Every ClassSession today across the institute, with whether attendance
  // has been fully marked yet — the teacher/owner "what's on today" view.
  fastify.get("/today", async (request) => {
    const { instituteId } = asStaff(request.user);
    const today = toDateOnly(new Date());

    const sessions = await prisma.classSession.findMany({
      where: { date: today, orgUnit: { instituteId } },
      include: {
        orgUnit: { select: { id: true, name: true } },
        course: { select: { id: true, name: true, teacher: { select: { id: true, name: true } } } },
        attendance: { select: { studentId: true } },
      },
      orderBy: { startTime: "asc" },
    });

    // Roster size varies per session (a subject's students vs. the whole
    // group), so it can't come from one groupBy.
    const rosterSizes = await Promise.all(sessions.map(async (s) => (await rosterForSession(s)).length));

    return sessions.map((s, i) => ({
      id: s.id,
      orgUnit: s.orgUnit,
      course: s.course,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      enrolledCount: rosterSizes[i],
      markedCount: s.attendance.length,
    }));
  });

  // Top-line numbers for the dashboard home screen.
  fastify.get("/summary", async (request) => {
    const { instituteId } = asStaff(request.user);
    const today = toDateOnly(new Date());
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const [activeStudentCount, activeUnitCount, activeCourseCount, todaysSessions, outstandingInvoices, collectedThisMonth] =
      await Promise.all([
        prisma.student.count({ where: { instituteId, isActive: true } }),
        prisma.orgUnit.count({ where: { instituteId, isActive: true } }),
        prisma.course.count({ where: { instituteId, isActive: true } }),
        prisma.classSession.findMany({
          where: { date: today, orgUnit: { instituteId } },
          include: { attendance: { select: { studentId: true } } },
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

    const rosterSizes = await Promise.all(todaysSessions.map(async (s) => (await rosterForSession(s)).length));
    const unmarkedSessionCount = todaysSessions.filter((s, i) => s.attendance.length < rosterSizes[i]).length;

    const outstandingTotal = outstandingInvoices.reduce((sum, inv) => {
      const paid = inv.payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
      return sum.plus(Prisma.Decimal.max(inv.amount.minus(paid), 0));
    }, new Prisma.Decimal(0));

    return {
      activeStudentCount,
      activeUnitCount,
      activeCourseCount,
      todaysSessionCount: todaysSessions.length,
      unmarkedSessionCount,
      outstandingInvoiceCount: outstandingInvoices.length,
      outstandingInvoiceTotal: outstandingTotal.toFixed(2),
      collectedThisMonthTotal: (collectedThisMonth._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    };
  });
}
