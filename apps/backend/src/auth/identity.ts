import { prisma } from "../db.js";

export type Identity =
  | { kind: "STAFF"; userId: string; instituteId: string; role: "OWNER" | "TEACHER" }
  | { kind: "STUDENT"; studentId: string; instituteId: string };

/** Resolves a login email to whichever account owns it — a staff User or a portal-enabled Student. */
export async function resolveIdentityByEmail(email: string): Promise<Identity | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.isActive) {
    return { kind: "STAFF", userId: user.id, instituteId: user.instituteId, role: user.role };
  }

  const student = await prisma.student.findUnique({ where: { portalEmail: email } });
  if (student && student.isActive) {
    return { kind: "STUDENT", studentId: student.id, instituteId: student.instituteId };
  }

  return null;
}

type StaffIdentity = Extract<Identity, { kind: "STAFF" }>;

/**
 * Narrows an already-authenticated identity to STAFF. Safe to call in any
 * handler behind the `requireStaff` preHandler, which has already rejected
 * non-staff callers at runtime — this just gives TypeScript the same fact.
 */
export function asStaff(identity: Identity): StaffIdentity {
  if (identity.kind !== "STAFF") {
    throw new Error("Expected a staff identity");
  }
  return identity;
}
