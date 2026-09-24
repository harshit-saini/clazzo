import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { asStaff } from "../auth/identity.js";
import { findOrgUnit, rosterForCourse } from "../lib/orgStructure.js";
import { logAudit } from "../lib/audit.js";

const createCourseSchema = z.object({
  orgUnitId: z.string(),
  name: z.string().min(1),
  code: z.string().optional(),
  teacherId: z.string().optional(),
  enrollmentMode: z.enum(["ALL_IN_UNIT", "SELECTED"]).optional(),
});

const updateCourseSchema = createCourseSchema.omit({ orgUnitId: true }).partial();
const enrollSchema = z.object({ studentId: z.string() });

async function assertTeacher(teacherId: string | undefined, instituteId: string) {
  if (!teacherId) return true;
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, instituteId } });
  return Boolean(teacher);
}

export default async function courseRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireStaff);

  fastify.get("/", async (request) => {
    const { instituteId } = asStaff(request.user);
    const { teacherId } = request.query as { teacherId?: string };

    return prisma.course.findMany({
      where: { instituteId, isActive: true, ...(teacherId ? { teacherId } : {}) },
      include: {
        teacher: { select: { id: true, name: true } },
        orgUnit: { select: { id: true, name: true, depth: true } },
        _count: { select: { courseEnrollments: true } },
      },
      orderBy: [{ orgUnit: { depth: "asc" } }, { name: "asc" }],
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { instituteId } = asStaff(request.user);

    const course = await prisma.course.findFirst({
      where: { id, instituteId },
      include: {
        teacher: { select: { id: true, name: true } },
        orgUnit: true,
        scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      },
    });
    if (!course) return reply.code(404).send({ error: "Not found" });

    return { ...course, roster: await rosterForCourse(course) };
  });

  fastify.post("/", async (request, reply) => {
    const { instituteId } = asStaff(request.user);
    const body = createCourseSchema.parse(request.body);

    const unit = await findOrgUnit(body.orgUnitId, instituteId);
    if (!unit) return reply.code(404).send({ error: "Org unit not found" });
    if (!(await assertTeacher(body.teacherId, instituteId))) {
      return reply.code(404).send({ error: "Teacher not found" });
    }

    const course = await prisma.course.create({
      data: { instituteId, ...body },
      include: { teacher: { select: { id: true, name: true } }, orgUnit: { select: { id: true, name: true } } },
    });

    await logAudit({
      actor: request.user,
      instituteId,
      action: "course.create",
      entityType: "Course",
      entityId: course.id,
      metadata: { name: course.name, orgUnitId: course.orgUnitId, teacherId: course.teacherId },
    });

    return reply.code(201).send(course);
  });

  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { instituteId } = asStaff(request.user);
    const body = updateCourseSchema.parse(request.body);

    const existing = await prisma.course.findFirst({ where: { id, instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });
    if (!(await assertTeacher(body.teacherId, instituteId))) {
      return reply.code(404).send({ error: "Teacher not found" });
    }

    return prisma.course.update({
      where: { id },
      data: body,
      include: { teacher: { select: { id: true, name: true } }, orgUnit: { select: { id: true, name: true } } },
    });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { instituteId } = asStaff(request.user);

    const existing = await prisma.course.findFirst({ where: { id, instituteId } });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    await prisma.course.update({ where: { id }, data: { isActive: false } });
    return reply.code(204).send();
  });

  // ─── Elective opt-ins (SELECTED courses only) ─────────────────────────

  fastify.post("/:id/enroll", async (request, reply) => {
    const { id: courseId } = request.params as { id: string };
    const { instituteId } = asStaff(request.user);
    const { studentId } = enrollSchema.parse(request.body);

    const [course, student] = await Promise.all([
      prisma.course.findFirst({ where: { id: courseId, instituteId } }),
      prisma.student.findFirst({ where: { id: studentId, instituteId } }),
    ]);
    if (!course || !student) return reply.code(404).send({ error: "Course or student not found" });
    if (course.enrollmentMode !== "SELECTED") {
      return reply.code(409).send({
        error: "This course is taken by everyone in its group — switch it to selected students first",
      });
    }

    const enrollment = await prisma.courseEnrollment.upsert({
      where: { courseId_studentId: { courseId, studentId } },
      update: {},
      create: { courseId, studentId },
    });
    return reply.code(201).send(enrollment);
  });

  fastify.delete("/:id/enroll/:studentId", async (request, reply) => {
    const { id: courseId, studentId } = request.params as { id: string; studentId: string };
    const { instituteId } = asStaff(request.user);

    const course = await prisma.course.findFirst({ where: { id: courseId, instituteId } });
    if (!course) return reply.code(404).send({ error: "Not found" });

    await prisma.courseEnrollment.deleteMany({ where: { courseId, studentId } });
    return reply.code(204).send();
  });
}
