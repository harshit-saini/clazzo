import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { buildPath, coursesForUnit, findOrgUnit, rosterForUnit } from "../lib/orgStructure.js";
import { logAudit } from "../lib/audit.js";

const levelsSchema = z.object({
  levels: z.array(z.object({ name: z.string().min(1) })).max(6),
});

const createUnitSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
});

const renameUnitSchema = z.object({ name: z.string().min(1) });
const enrollSchema = z.object({ studentId: z.string() });

export default async function structureRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  // ─── Levels ───────────────────────────────────────────────────────────

  fastify.get("/levels", async (request) => {
    return prisma.orgLevel.findMany({
      where: { instituteId: asStaff(request.user).instituteId },
      orderBy: { depth: "asc" },
    });
  });

  // Replaces the whole ladder in one call — the UI edits it as a list.
  // Units sitting at a depth that no longer exists keep their place in the
  // tree and simply lose their level label (FK is ON DELETE SET NULL).
  fastify.put("/levels", async (request) => {
    const { instituteId } = asStaff(request.user);
    const { levels } = levelsSchema.parse(request.body);

    return prisma.$transaction(async (tx) => {
      await tx.orgLevel.deleteMany({ where: { instituteId, depth: { gte: levels.length } } });

      for (const [depth, level] of levels.entries()) {
        await tx.orgLevel.upsert({
          where: { instituteId_depth: { instituteId, depth } },
          update: { name: level.name },
          create: { instituteId, depth, name: level.name },
        });
      }

      const saved = await tx.orgLevel.findMany({ where: { instituteId }, orderBy: { depth: "asc" } });

      // Re-label units to match the new ladder, by depth.
      for (const level of saved) {
        await tx.orgUnit.updateMany({ where: { instituteId, depth: level.depth }, data: { levelId: level.id } });
      }
      await tx.orgUnit.updateMany({
        where: { instituteId, depth: { gte: saved.length } },
        data: { levelId: null },
      });

      return saved;
    });
  });

  // ─── Units ────────────────────────────────────────────────────────────

  // Flat list of the whole tree. The client assembles it (and rolls counts
  // up the tree) — cheaper than a query per node.
  fastify.get("/units", async (request) => {
    const { instituteId } = asStaff(request.user);
    const units = await prisma.orgUnit.findMany({
      where: { instituteId, isActive: true },
      include: {
        level: { select: { id: true, name: true, depth: true } },
        _count: {
          select: {
            enrollments: { where: { status: "ACTIVE" } },
            courses: { where: { isActive: true } },
          },
        },
      },
      orderBy: [{ depth: "asc" }, { name: "asc" }],
    });

    return units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      parentId: unit.parentId,
      depth: unit.depth,
      path: unit.path,
      level: unit.level,
      directStudents: unit._count.enrollments,
      directCourses: unit._count.courses,
    }));
  });

  fastify.get("/units/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { instituteId } = asStaff(request.user);

    const unit = await prisma.orgUnit.findFirst({
      where: { id, instituteId },
      include: { level: true, feeStructure: true },
    });
    if (!unit) return reply.code(404).send({ error: "Not found" });

    const [children, courses, roster, ancestors] = await Promise.all([
      prisma.orgUnit.findMany({
        where: { parentId: unit.id, isActive: true },
        include: { level: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      coursesForUnit(unit),
      rosterForUnit(unit),
      prisma.orgUnit.findMany({
        where: { id: { in: unit.path.split("/").filter(Boolean).filter((x) => x !== unit.id) } },
        select: { id: true, name: true },
      }),
    ]);

    return {
      ...unit,
      ancestors,
      children,
      // Courses attached higher up the tree apply here too; flag which are
      // inherited so the UI can show where they came from.
      courses: courses.map((course) => ({ ...course, inherited: course.orgUnitId !== unit.id })),
      roster,
    };
  });

  fastify.post("/units", async (request, reply) => {
    const { instituteId } = asStaff(request.user);
    const body = createUnitSchema.parse(request.body);

    let parent = null;
    if (body.parentId) {
      parent = await findOrgUnit(body.parentId, instituteId);
      if (!parent) return reply.code(404).send({ error: "Parent unit not found" });
    }

    const depth = parent ? parent.depth + 1 : 0;

    const duplicate = await prisma.orgUnit.findFirst({
      where: { instituteId, parentId: body.parentId ?? null, name: body.name, isActive: true },
    });
    if (duplicate) {
      return reply.code(409).send({ error: `"${body.name}" already exists here` });
    }

    // Units may be created deeper than the defined ladder; they just have
    // no level label until the admin adds one.
    const level = await prisma.orgLevel.findUnique({ where: { instituteId_depth: { instituteId, depth } } });

    const unit = await prisma.orgUnit.create({
      data: {
        instituteId,
        parentId: parent?.id ?? null,
        levelId: level?.id ?? null,
        name: body.name,
        depth,
        path: "", // replaced below — the path needs the generated id
      },
    });

    const withPath = await prisma.orgUnit.update({
      where: { id: unit.id },
      data: { path: buildPath(parent?.path ?? null, unit.id) },
    });

    await logAudit({
      actor: request.user,
      instituteId,
      action: "orgUnit.create",
      entityType: "OrgUnit",
      entityId: unit.id,
      metadata: { name: unit.name, parentId: unit.parentId },
    });

    return reply.code(201).send(withPath);
  });

  fastify.patch("/units/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { instituteId } = asStaff(request.user);
    const body = renameUnitSchema.parse(request.body);

    const unit = await findOrgUnit(id, instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    const duplicate = await prisma.orgUnit.findFirst({
      where: { instituteId, parentId: unit.parentId, name: body.name, isActive: true, id: { not: id } },
    });
    if (duplicate) return reply.code(409).send({ error: `"${body.name}" already exists here` });

    return prisma.orgUnit.update({ where: { id }, data: { name: body.name } });
  });

  // Archives rather than deletes, and takes the whole subtree with it —
  // removing "Class 12" must not leave 12A orphaned and still listed.
  fastify.delete("/units/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { instituteId } = asStaff(request.user);

    const unit = await findOrgUnit(id, instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    const { count } = await prisma.orgUnit.updateMany({
      where: { instituteId, path: { startsWith: unit.path } },
      data: { isActive: false },
    });

    await logAudit({
      actor: request.user,
      instituteId,
      action: "orgUnit.archive",
      entityType: "OrgUnit",
      entityId: id,
      metadata: { name: unit.name, unitsArchived: count },
    });

    return reply.code(204).send();
  });

  // ─── Enrollment ───────────────────────────────────────────────────────

  fastify.post("/units/:id/enroll", async (request, reply) => {
    const { id: orgUnitId } = request.params as { id: string };
    const { instituteId } = asStaff(request.user);
    const { studentId } = enrollSchema.parse(request.body);

    const [unit, student] = await Promise.all([
      findOrgUnit(orgUnitId, instituteId),
      prisma.student.findFirst({ where: { id: studentId, instituteId } }),
    ]);
    if (!unit || !student) return reply.code(404).send({ error: "Unit or student not found" });

    const enrollment = await prisma.enrollment.upsert({
      where: { orgUnitId_studentId: { orgUnitId, studentId } },
      update: { status: "ACTIVE" },
      create: { orgUnitId, studentId, status: "ACTIVE" },
    });

    await logAudit({
      actor: request.user,
      instituteId,
      action: "enrollment.create",
      entityType: "Enrollment",
      entityId: enrollment.id,
      metadata: { studentId, orgUnitId },
    });

    return reply.code(201).send(enrollment);
  });

  fastify.delete("/units/:id/enroll/:studentId", async (request, reply) => {
    const { id: orgUnitId, studentId } = request.params as { id: string; studentId: string };
    const { instituteId } = asStaff(request.user);

    const unit = await findOrgUnit(orgUnitId, instituteId);
    if (!unit) return reply.code(404).send({ error: "Not found" });

    await prisma.enrollment.updateMany({ where: { orgUnitId, studentId }, data: { status: "DROPPED" } });
    return reply.code(204).send();
  });
}
