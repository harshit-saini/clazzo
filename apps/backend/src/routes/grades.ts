import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";

const gradeSchema = z.object({ name: z.string().min(1) });

export default async function gradeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  fastify.get("/", async (request) => {
    return prisma.grade.findMany({
      where: { instituteId: asStaff(request.user).instituteId },
      orderBy: { name: "asc" },
    });
  });

  fastify.post("/", async (request, reply) => {
    const body = gradeSchema.parse(request.body);

    const existing = await prisma.grade.findUnique({
      where: { instituteId_name: { instituteId: asStaff(request.user).instituteId, name: body.name } },
    });
    if (existing) return reply.code(409).send({ error: "A grade with this name already exists" });

    const grade = await prisma.grade.create({ data: { instituteId: asStaff(request.user).instituteId, ...body } });
    return reply.code(201).send(grade);
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = gradeSchema.parse(request.body);

    const existing = await prisma.grade.findFirst({ where: { id, instituteId: asStaff(request.user).instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    return prisma.grade.update({ where: { id }, data: body });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.grade.findFirst({ where: { id, instituteId: asStaff(request.user).instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    try {
      await prisma.grade.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        return reply.code(409).send({ error: "This grade is still assigned to students or batches" });
      }
      throw error;
    }
    return reply.code(204).send();
  });
}
