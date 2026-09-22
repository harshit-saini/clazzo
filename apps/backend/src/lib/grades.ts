import { prisma } from "../db.js";
import { httpError } from "./httpError.js";

export async function assertGradeInInstitute(gradeId: string | undefined, instituteId: string) {
  if (!gradeId) return;
  const grade = await prisma.grade.findFirst({ where: { id: gradeId, instituteId } });
  if (!grade) throw httpError(400, "Invalid gradeId for this institute");
}
