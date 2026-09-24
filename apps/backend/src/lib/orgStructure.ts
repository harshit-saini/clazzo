import type { Course, OrgUnit } from "@prisma/client";
import { prisma } from "../db.js";

/// The level ladder each org type starts with. Purely a starting point —
/// levels are editable per institute once the account exists.
export const ORG_TEMPLATES: Record<string, string[]> = {
  SCHOOL: ["Class", "Section"],
  COLLEGE: ["Batch", "Stream", "Section"],
  COACHING: ["Batch"],
  TUTOR: ["Batch"],
};

/// Path of a unit given its parent's path: "/grandparent/parent/self/".
/// Roots get "/self/". Always leading+trailing slash so a prefix match on
/// a path can never straddle an id boundary.
export function buildPath(parentPath: string | null, id: string) {
  return `${parentPath ?? "/"}${id}/`;
}

/// Every unit id on the path from the root down to (and including) this
/// unit. Read straight out of the materialized path — no query needed.
export function lineageIds(path: string) {
  return path.split("/").filter(Boolean);
}

export async function findOrgUnit(id: string, instituteId: string) {
  return prisma.orgUnit.findFirst({ where: { id, instituteId } });
}

/// Courses that apply to a unit: those attached to it, plus those attached
/// to any ancestor (a subject on "Class 12" is taught to 12A and 12B).
export async function coursesForUnit(unit: OrgUnit) {
  return prisma.course.findMany({
    where: { orgUnitId: { in: lineageIds(unit.path) }, isActive: true },
    include: { teacher: { select: { id: true, name: true } }, orgUnit: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

/// Active students enrolled in a unit or any of its descendants — a class's
/// roster is the union of its sections' rosters.
export async function rosterForUnit(unit: OrgUnit) {
  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ACTIVE", orgUnit: { path: { startsWith: unit.path } } },
    include: { student: { select: { id: true, name: true, phone: true, isActive: true } } },
    orderBy: { student: { name: "asc" } },
  });

  // A student enrolled in two descendant units would otherwise appear twice.
  const seen = new Map<string, (typeof enrollments)[number]["student"]>();
  for (const { student } of enrollments) {
    if (student.isActive) seen.set(student.id, student);
  }
  return [...seen.values()];
}

/// Who is taking a course. ALL_IN_UNIT courses use the org unit's roster;
/// SELECTED courses (electives) use explicit opt-ins.
export async function rosterForCourse(course: Course & { orgUnit?: OrgUnit }) {
  if (course.enrollmentMode === "SELECTED") {
    const picks = await prisma.courseEnrollment.findMany({
      where: { courseId: course.id },
      include: { student: { select: { id: true, name: true, phone: true, isActive: true } } },
      orderBy: { student: { name: "asc" } },
    });
    return picks.map((p) => p.student).filter((s) => s.isActive);
  }

  const unit = course.orgUnit ?? (await prisma.orgUnit.findUniqueOrThrow({ where: { id: course.orgUnitId } }));
  return rosterForUnit(unit);
}

/// Students attending a session. The session's own org unit decides who is
/// in the room — *not* the course's, which may sit further up the tree: a
/// Maths period for 12A must not pull in 12B just because Maths is
/// attached to Class 12. A SELECTED course then narrows that group to the
/// students who opted into the elective.
export async function rosterForSession(session: { orgUnitId: string; courseId: string | null }) {
  const unit = await prisma.orgUnit.findUniqueOrThrow({ where: { id: session.orgUnitId } });
  const inTheRoom = await rosterForUnit(unit);
  if (!session.courseId) return inTheRoom;

  const course = await prisma.course.findUniqueOrThrow({ where: { id: session.courseId } });
  if (course.enrollmentMode !== "SELECTED") return inTheRoom;

  const picks = await prisma.courseEnrollment.findMany({
    where: { courseId: course.id },
    select: { studentId: true },
  });
  const optedIn = new Set(picks.map((p) => p.studentId));
  return inTheRoom.filter((student) => optedIn.has(student.id));
}
