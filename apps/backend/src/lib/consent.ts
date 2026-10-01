import type { ConsentStatus } from "@prisma/client";
import { prisma } from "../db.js";
import { issueConsentOtpForEmail } from "../auth/issueOtp.js";

/** Students a guardian email is responsible for, in the given consent states. */
export function studentsForGuardian(guardianEmail: string, statuses: ConsentStatus[]) {
  return prisma.student.findMany({
    where: { guardianEmail, consentStatus: { in: statuses }, isActive: true },
    include: { institute: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Emails a guardian one code covering every student they're responsible for
 * in the given states. Returns false (and sends nothing) when there's no
 * one to confirm, so callers can respond identically either way and not
 * reveal whether an email is on file.
 */
export async function sendConsentCodeFor(guardianEmail: string, statuses: ConsentStatus[]): Promise<boolean> {
  const students = await studentsForGuardian(guardianEmail, statuses);
  if (students.length === 0) return false;

  await issueConsentOtpForEmail(
    guardianEmail,
    students.map((s) => ({ name: s.name, instituteName: s.institute.name }))
  );
  return true;
}
