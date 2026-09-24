import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { eachDateInRange } from "../lib/dates.js";
import { findOrgUnit } from "../lib/orgStructure.js";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRe, "Expected HH:mm"),
  endTime: z.string().regex(timeRe, "Expected HH:mm"),
  // Omit to book an unsubjected period — a school's daily homeroom
  // attendance slot for the whole section.
  courseId: z.string().optional(),
});

const generateSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
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

  fastify.post("/units/:unitId/schedule", async (request, reply) => {
    const { unitId } = request.params as { unitId: string };
    const { instituteId } = asStaff(request.user);
    const body = slotSchema.parse(request.body);

    const unit = await findOrgUnit(unitId, instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    if (body.endTime <= body.startTime) {
      return reply.code(400).send({ error: "endTime must be after startTime" });
    }
    if (body.courseId && !(await assertCourseAppliesTo(body.courseId, unit.path, instituteId))) {
      return reply.code(400).send({ error: "That subject isn't taught to this group" });
    }

    const slot = await prisma.scheduleSlot.create({
      data: { orgUnitId: unitId, ...body },
      include: { course: { select: { id: true, name: true } } },
    });
    return reply.code(201).send(slot);
  });

  fastify.delete("/schedule/:slotId", async (request, reply) => {
    const { slotId } = request.params as { slotId: string };
    const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId }, include: { orgUnit: true } });
    if (!slot || slot.orgUnit.instituteId !== asStaff(request.user).instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }

    await prisma.scheduleSlot.delete({ where: { id: slotId } });
    return reply.code(204).send();
  });

  // Materializes concrete ClassSession rows from a unit's recurring
  // ScheduleSlots for every date in range — idempotent, safe to re-run.
  fastify.post("/units/:unitId/sessions/generate", async (request, reply) => {
    const { unitId } = request.params as { unitId: string };
    const { fromDate, toDate } = generateSchema.parse(request.body);

    const unit = await findOrgUnit(unitId, asStaff(request.user).instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    if (toDate < fromDate) {
      return reply.code(400).send({ error: "toDate must be on or after fromDate" });
    }

    const slots = await prisma.scheduleSlot.findMany({ where: { orgUnitId: unitId } });
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
          where: { orgUnitId: unitId, courseId: slot.courseId, date, startTime: slot.startTime },
        });
        if (existing) continue;

        await prisma.classSession.create({
          data: {
            orgUnitId: unitId,
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

  fastify.get("/units/:unitId/sessions", async (request, reply) => {
    const { unitId } = request.params as { unitId: string };
    const { from, to } = request.query as { from?: string; to?: string };

    const unit = await findOrgUnit(unitId, asStaff(request.user).instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    return prisma.classSession.findMany({
      where: {
        orgUnitId: unitId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: { course: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
  });

  fastify.patch("/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]) }).parse(request.body);

    const session = await prisma.classSession.findUnique({ where: { id }, include: { orgUnit: true } });
    if (!session || session.orgUnit.instituteId !== asStaff(request.user).instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }

    return prisma.classSession.update({ where: { id }, data: { status: body.status } });
  });
}
