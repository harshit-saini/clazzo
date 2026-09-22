import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { eachDateInRange } from "../lib/dates.js";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRe, "Expected HH:mm"),
  endTime: z.string().regex(timeRe, "Expected HH:mm"),
});

const generateSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
});

async function assertBatchInInstitute(batchId: string, instituteId: string) {
  return prisma.batch.findFirst({ where: { id: batchId, instituteId } });
}

export default async function scheduleRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  fastify.get("/batches/:batchId/schedule", async (request, reply) => {
    const { batchId } = request.params as { batchId: string };
    const batch = await assertBatchInInstitute(batchId, request.user.instituteId);
    if (!batch) return reply.code(404).send({ error: "Not found" });

    return prisma.scheduleSlot.findMany({ where: { batchId }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
  });

  fastify.post("/batches/:batchId/schedule", async (request, reply) => {
    const { batchId } = request.params as { batchId: string };
    const body = slotSchema.parse(request.body);

    const batch = await assertBatchInInstitute(batchId, request.user.instituteId);
    if (!batch) return reply.code(404).send({ error: "Not found" });

    if (body.endTime <= body.startTime) {
      return reply.code(400).send({ error: "endTime must be after startTime" });
    }

    const slot = await prisma.scheduleSlot.create({ data: { batchId, ...body } });
    return reply.code(201).send(slot);
  });

  fastify.delete("/schedule/:slotId", async (request, reply) => {
    const { slotId } = request.params as { slotId: string };
    const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId }, include: { batch: true } });
    if (!slot || slot.batch.instituteId !== request.user.instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }

    await prisma.scheduleSlot.delete({ where: { id: slotId } });
    return reply.code(204).send();
  });

  // Materializes concrete ClassSession rows from the batch's recurring
  // ScheduleSlots for every date in range — idempotent, safe to re-run.
  fastify.post("/batches/:batchId/sessions/generate", async (request, reply) => {
    const { batchId } = request.params as { batchId: string };
    const { fromDate, toDate } = generateSchema.parse(request.body);

    const batch = await assertBatchInInstitute(batchId, request.user.instituteId);
    if (!batch) return reply.code(404).send({ error: "Not found" });

    if (toDate < fromDate) {
      return reply.code(400).send({ error: "toDate must be on or after fromDate" });
    }

    const slots = await prisma.scheduleSlot.findMany({ where: { batchId } });
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
        const existing = await prisma.classSession.findUnique({
          where: { batchId_date_startTime: { batchId, date, startTime: slot.startTime } },
        });
        if (existing) continue;

        await prisma.classSession.create({
          data: { batchId, date, startTime: slot.startTime, endTime: slot.endTime },
        });
        created += 1;
      }
    }

    return reply.send({ created });
  });

  fastify.get("/batches/:batchId/sessions", async (request, reply) => {
    const { batchId } = request.params as { batchId: string };
    const { from, to } = request.query as { from?: string; to?: string };

    const batch = await assertBatchInInstitute(batchId, request.user.instituteId);
    if (!batch) return reply.code(404).send({ error: "Not found" });

    return prisma.classSession.findMany({
      where: {
        batchId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
  });

  fastify.patch("/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]) }).parse(request.body);

    const session = await prisma.classSession.findUnique({ where: { id }, include: { batch: true } });
    if (!session || session.batch.instituteId !== request.user.instituteId) {
      return reply.code(404).send({ error: "Not found" });
    }

    return prisma.classSession.update({ where: { id }, data: { status: body.status } });
  });
}
