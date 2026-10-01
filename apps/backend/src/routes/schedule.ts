import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { eachDateInRange, toDateOnly } from "../lib/dates.js";
import { findOrgUnit } from "../lib/orgStructure.js";
import { logAudit } from "../lib/audit.js";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRe, "Expected HH:mm"),
  endTime: z.string().regex(timeRe, "Expected HH:mm"),
  // Omit to book an unsubjected period — a school's daily homeroom
  // attendance slot for the whole section.
  courseId: z.string().nullable().optional(),
});

// One request can create the same period on several weekdays — setting up
// a timetable used to need one submit per weekday per subject.
const createSlotsSchema = slotSchema
  .omit({ dayOfWeek: true })
  .extend({ daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7) });

const generateSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  // Also generate for every group inside this one, using each group's own
  // timetable — so "Class 12" can cover 12A and 12B in one go.
  includeSubgroups: z.boolean().default(false),
});

const copySchema = z.object({
  fromUnitId: z.string(),
  // Wipe the target's existing timetable first instead of merging into it.
  replace: z.boolean().default(false),
});

const holidaySchema = z.object({
  date: z.coerce.date(),
  // Limit to one group (and everything inside it); omit for the whole institute.
  orgUnitId: z.string().optional(),
});

/// A course may only be scheduled against the unit it belongs to, or a
/// descendant of it (Maths on "Class 12" can be timetabled for 12A).
async function assertCourseAppliesTo(courseId: string, unitPath: string, instituteId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, instituteId },
    include: { orgUnit: { select: { path: true } } },
  });
  if (!course) return null;
  return unitPath.startsWith(course.orgUnit.path) ? course : null;
}

export default async function scheduleRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  fastify.get("/units/:unitId/schedule", async (request, reply) => {
    const { unitId } = request.params as { unitId: string };
    const unit = await findOrgUnit(unitId, asStaff(request.user).instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    return prisma.scheduleSlot.findMany({
      where: { orgUnitId: unitId },
      include: { course: { select: { id: true, name: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  });

  // Timetable changes are structural, like the groups and subjects they
  // hang off — owner-only. (They used to accept any staff member, so a
  // teacher or accountant could rewrite any group's timetable.)
  fastify.post("/units/:unitId/schedule", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const { unitId } = request.params as { unitId: string };
    const { instituteId } = asStaff(request.user);
    const body = createSlotsSchema.parse(request.body);

    const unit = await findOrgUnit(unitId, instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    if (body.endTime <= body.startTime) {
      return reply.code(400).send({ error: "endTime must be after startTime" });
    }
    if (body.courseId && !(await assertCourseAppliesTo(body.courseId, unit.path, instituteId))) {
      return reply.code(400).send({ error: "That subject isn't taught to this group" });
    }

    const days = [...new Set(body.daysOfWeek)];
    const slots = await prisma.$transaction(
      days.map((dayOfWeek) =>
        prisma.scheduleSlot.create({
          data: {
            orgUnitId: unitId,
            dayOfWeek,
            startTime: body.startTime,
            endTime: body.endTime,
            courseId: body.courseId ?? null,
          },
          include: { course: { select: { id: true, name: true } } },
        })
      )
    );
    return reply.code(201).send(slots);
  });

  fastify.patch("/schedule/:slotId", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const { slotId } = request.params as { slotId: string };
    const { instituteId } = asStaff(request.user);
    const body = slotSchema.partial().parse(request.body);

    const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId }, include: { orgUnit: true } });
    if (!slot || slot.orgUnit.instituteId !== instituteId) return reply.code(404).send({ error: "Not found" });

    const startTime = body.startTime ?? slot.startTime;
    const endTime = body.endTime ?? slot.endTime;
    if (endTime <= startTime) return reply.code(400).send({ error: "endTime must be after startTime" });

    if (body.courseId && !(await assertCourseAppliesTo(body.courseId, slot.orgUnit.path, instituteId))) {
      return reply.code(400).send({ error: "That subject isn't taught to this group" });
    }

    return prisma.scheduleSlot.update({
      where: { id: slotId },
      data: body,
      include: { course: { select: { id: true, name: true } } },
    });
  });

  fastify.delete("/schedule/:slotId", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const { slotId } = request.params as { slotId: string };
    const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId }, include: { orgUnit: true } });
    if (!slot || slot.orgUnit.instituteId !== asStaff(request.user).instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }

    await prisma.scheduleSlot.delete({ where: { id: slotId } });
    return reply.code(204).send();
  });

  // Copies one group's weekly timetable onto another ("same as 12A").
  // Slots for a subject that doesn't apply to the target (12A's Biology
  // can't be timetabled for 12B) are skipped and counted, not errors.
  fastify.post("/units/:unitId/schedule/copy", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const { unitId } = request.params as { unitId: string };
    const { instituteId } = asStaff(request.user);
    const body = copySchema.parse(request.body);

    if (body.fromUnitId === unitId) return reply.code(400).send({ error: "Pick a different group to copy from" });

    const [target, source] = await Promise.all([
      findOrgUnit(unitId, instituteId),
      findOrgUnit(body.fromUnitId, instituteId),
    ]);
    if (!target || !source) return reply.code(404).send({ error: "Not found" });

    const [sourceSlots, existing] = await Promise.all([
      prisma.scheduleSlot.findMany({ where: { orgUnitId: source.id } }),
      prisma.scheduleSlot.findMany({ where: { orgUnitId: target.id } }),
    ]);

    const keep = body.replace ? [] : existing;
    const keyOf = (s: { dayOfWeek: number; startTime: string; endTime: string; courseId: string | null }) =>
      `${s.dayOfWeek}|${s.startTime}|${s.endTime}|${s.courseId ?? ""}`;
    const have = new Set(keep.map(keyOf));

    const applicable = new Map<string, boolean>();
    let skipped = 0;
    const toCreate: typeof sourceSlots = [];
    for (const slot of sourceSlots) {
      if (slot.courseId) {
        if (!applicable.has(slot.courseId)) {
          applicable.set(slot.courseId, Boolean(await assertCourseAppliesTo(slot.courseId, target.path, instituteId)));
        }
        if (!applicable.get(slot.courseId)) {
          skipped += 1;
          continue;
        }
      }
      if (have.has(keyOf(slot))) continue;
      have.add(keyOf(slot));
      toCreate.push(slot);
    }

    await prisma.$transaction([
      ...(body.replace ? [prisma.scheduleSlot.deleteMany({ where: { orgUnitId: target.id } })] : []),
      prisma.scheduleSlot.createMany({
        data: toCreate.map((s) => ({
          orgUnitId: target.id,
          courseId: s.courseId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      }),
    ]);

    return reply.send({ copied: toCreate.length, skipped });
  });

  // Materializes concrete ClassSession rows from a unit's recurring
  // ScheduleSlots for every date in range — idempotent, safe to re-run.
  fastify.post("/units/:unitId/sessions/generate", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const { unitId } = request.params as { unitId: string };
    const { fromDate, toDate, includeSubgroups } = generateSchema.parse(request.body);

    const unit = await findOrgUnit(unitId, asStaff(request.user).instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    if (toDate < fromDate) {
      return reply.code(400).send({ error: "toDate must be on or after fromDate" });
    }

    const slots = await prisma.scheduleSlot.findMany({
      where: includeSubgroups ? { orgUnit: { path: { startsWith: unit.path }, isActive: true } } : { orgUnitId: unitId },
    });
    if (slots.length === 0) return reply.send({ created: 0 });

    const slotsByDay = new Map<number, typeof slots>();
    for (const slot of slots) {
      const list = slotsByDay.get(slot.dayOfWeek) ?? [];
      list.push(slot);
      slotsByDay.set(slot.dayOfWeek, list);
    }

    let created = 0;
    for (const date of eachDateInRange(fromDate, toDate)) {
      const daySlots = slotsByDay.get(date.getUTCDay());
      if (!daySlots) continue;

      for (const slot of daySlots) {
        // findFirst, not findUnique: Postgres treats NULLs as distinct, so
        // the unique index doesn't dedupe course-less homeroom sessions.
        const existing = await prisma.classSession.findFirst({
          where: { orgUnitId: slot.orgUnitId, courseId: slot.courseId, date, startTime: slot.startTime },
        });
        if (existing) continue;

        await prisma.classSession.create({
          data: {
            orgUnitId: slot.orgUnitId,
            courseId: slot.courseId,
            date,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        });
        created += 1;
      }
    }

    return reply.send({ created });
  });

  // A group's sessions in a date window. A TEACHER only sees sessions for
  // subjects they teach (anything else would offer a "Mark attendance" link
  // that 403s); an ACCOUNTANT has no attendance role and sees none.
  fastify.get("/units/:unitId/sessions", async (request, reply) => {
    const { unitId } = request.params as { unitId: string };
    const staff = asStaff(request.user);
    const { from, to, order } = request.query as { from?: string; to?: string; order?: string };

    const unit = await findOrgUnit(unitId, staff.instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    if (staff.role === "ACCOUNTANT") return [];

    return prisma.classSession.findMany({
      where: {
        orgUnitId: unitId,
        ...(staff.role === "TEACHER" ? { course: { teacherId: staff.userId } } : {}),
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        course: { select: { id: true, name: true } },
        _count: { select: { attendance: true } },
      },
      orderBy: [{ date: order === "desc" ? "desc" : "asc" }, { startTime: "asc" }],
      take: 200,
    });
  });

  // Cancel (or restore) a session. The owner can touch any; a teacher only
  // sessions of a subject they teach.
  fastify.patch("/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const staff = asStaff(request.user);
    const body = z.object({ status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]) }).parse(request.body);

    const session = await prisma.classSession.findUnique({
      where: { id },
      include: { orgUnit: true, course: { select: { teacherId: true } } },
    });
    if (!session || session.orgUnit.instituteId !== staff.instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }

    const allowed =
      staff.role === "OWNER" || (staff.role === "TEACHER" && session.course?.teacherId === staff.userId);
    if (!allowed) return reply.code(403).send({ error: "You can't change this session" });

    return prisma.classSession.update({ where: { id }, data: { status: body.status } });
  });

  // Marks a day off: every still-scheduled session that day (without
  // attendance already recorded) is cancelled so it stops showing as "not
  // yet marked" forever.
  fastify.post("/sessions/holiday", { preHandler: fastify.requireOwner }, async (request, reply) => {
    const staff = asStaff(request.user);
    const body = holidaySchema.parse(request.body);

    let unitFilter = {};
    if (body.orgUnitId) {
      const unit = await findOrgUnit(body.orgUnitId, staff.instituteId);
      if (!unit) return reply.code(404).send({ error: "Group not found" });
      unitFilter = { path: { startsWith: unit.path } };
    }

    const result = await prisma.classSession.updateMany({
      where: {
        date: toDateOnly(body.date),
        status: "SCHEDULED",
        // A class that already has attendance recorded actually happened —
        // cancelling it would erase real records from every report.
        attendance: { none: {} },
        orgUnit: { instituteId: staff.instituteId, ...unitFilter },
      },
      data: { status: "CANCELLED" },
    });

    await logAudit({
      actor: staff,
      instituteId: staff.instituteId,
      action: "session.holiday",
      entityType: "Institute",
      entityId: staff.instituteId,
      metadata: { date: toDateOnly(body.date).toISOString(), orgUnitId: body.orgUnitId ?? null, cancelled: result.count },
    });

    return reply.send({ cancelled: result.count });
  });
}
