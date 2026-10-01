import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { toDateOnly } from "../lib/dates.js";
import { rosterForSession } from "../lib/orgStructure.js";
import { isPastDue, remainingOf } from "../lib/invoices.js";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  // ClassSessions across the institute with whether attendance has been
  // fully marked — the teacher/owner "what's on" view. Defaults to today;
  // `date=YYYY-MM-DD` shows another day, and `from`/`to` (max 31 days) with
  // `unmarked=1` lists past sessions still awaiting attendance, which is how
  // a teacher gets back to yesterday's class. Cancelled sessions (holidays)
  // never appear. A TEACHER only sees sessions for a course they teach —
  // anything else would show a "Mark attendance" link that then 403s (see
  // attendance.ts's per-session scoping), so this list has to agree with
  // what they can act on. An ACCOUNTANT has no attendance role.
  fastify.get("/today", async (request) => {
    const staffMe = asStaff(request.user);
    const { instituteId } = staffMe;
    if (staffMe.role === "ACCOUNTANT") return [];

    const q = request.query as { date?: string; from?: string; to?: string; unmarked?: string };
    const today = toDateOnly(new Date());

    let dateFilter: { equals: Date } | { gte: Date; lte: Date };
    if (q.from || q.to) {
      // "Still awaiting attendance" is about classes that have happened, so
      // an unmarked listing never reaches into the future.
      const requestedTo = q.to ? toDateOnly(new Date(q.to)) : today;
      const to = q.unmarked === "1" && requestedTo > today ? today : requestedTo;
      const earliest = new Date(to);
      earliest.setUTCDate(earliest.getUTCDate() - 31);
      const from = q.from ? toDateOnly(new Date(q.from)) : earliest;
      dateFilter = { gte: from < earliest ? earliest : from, lte: to };
    } else {
      dateFilter = { equals: q.date ? toDateOnly(new Date(q.date)) : today };
    }

    const sessions = await prisma.classSession.findMany({
      where: {
        date: dateFilter,
        status: { not: "CANCELLED" },
        orgUnit: { instituteId },
        ...(staffMe.role === "TEACHER" ? { course: { teacherId: staffMe.userId } } : {}),
      },
      include: {
        orgUnit: { select: { id: true, name: true } },
        course: { select: { id: true, name: true, teacher: { select: { id: true, name: true } } } },
        attendance: { select: { studentId: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "asc" }],
      take: 300,
    });

    // Roster size varies per session (a subject's students vs. the whole
    // group), so it can't come from one groupBy.
    const rosterSizes = await Promise.all(sessions.map(async (s) => (await rosterForSession(s)).length));

    const rows = sessions.map((s, i) => ({
      id: s.id,
      date: s.date,
      orgUnit: s.orgUnit,
      course: s.course,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      enrolledCount: rosterSizes[i],
      markedCount: s.attendance.length,
    }));

    return q.unmarked === "1" ? rows.filter((r) => r.markedCount < r.enrolledCount) : rows;
  });

  // Top-line numbers for the dashboard home screen. The institute-wide
  // totals (students, revenue, ...) stay aggregate for every role — they're
  // summary counts, not itemized PII/fee data — but the "unmarked today"
  // count is scoped the same way /today's session list is, so the heading
  // above that list ("N not yet marked") always matches what's actually shown.
  fastify.get("/summary", async (request) => {
    const staffMe = asStaff(request.user);
    const { instituteId } = staffMe;
    const today = toDateOnly(new Date());
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const [activeStudentCount, activeUnitCount, activeCourseCount, todaysSessions, outstandingInvoices, collectedThisMonth] =
      await Promise.all([
        prisma.student.count({ where: { instituteId, isActive: true } }),
        prisma.orgUnit.count({ where: { instituteId, isActive: true } }),
        prisma.course.count({ where: { instituteId, isActive: true } }),
        prisma.classSession.findMany({
          where: {
            date: today,
            status: { not: "CANCELLED" },
            orgUnit: { instituteId },
            ...(staffMe.role === "TEACHER" ? { course: { teacherId: staffMe.userId } } : {}),
          },
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

    const outstandingTotal = outstandingInvoices.reduce((sum, inv) => sum.plus(remainingOf(inv)), new Prisma.Decimal(0));
    const overdueInvoices = outstandingInvoices.filter((inv) => isPastDue(inv));
    const overdueTotal = overdueInvoices.reduce((sum, inv) => sum.plus(remainingOf(inv)), new Prisma.Decimal(0));

    // Fee totals are family financial data — fees.ts keeps them from a
    // TEACHER, and the summary mustn't leak them back out as aggregates.
    const canSeeFees = staffMe.role !== "TEACHER";

    return {
      activeStudentCount,
      activeUnitCount,
      activeCourseCount,
      todaysSessionCount: todaysSessions.length,
      unmarkedSessionCount,
      outstandingInvoiceCount: canSeeFees ? outstandingInvoices.length : null,
      outstandingInvoiceTotal: canSeeFees ? outstandingTotal.toFixed(2) : null,
      overdueInvoiceCount: canSeeFees ? overdueInvoices.length : null,
      overdueInvoiceTotal: canSeeFees ? overdueTotal.toFixed(2) : null,
      collectedThisMonthTotal: canSeeFees ? (collectedThisMonth._sum.amount ?? new Prisma.Decimal(0)).toFixed(2) : null,
    };
  });
}
