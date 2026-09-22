import { prisma } from "../db.js";

export type Identity =
  | { kind: "STAFF"; userId: string; instituteId: string; role: "OWNER" | "TEACHER" }
  | { kind: "STUDENT"; studentAccountId: string };

/** Resolves a login email to whichever account owns it — a staff User or a StudentAccount. */
export async function resolveIdentityByEmail(email: string): Promise<Identity | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.isActive) {
    return { kind: "STAFF", userId: user.id, instituteId: user.instituteId, role: user.role };
  }

  const account = await prisma.studentAccount.findUnique({ where: { email } });
  if (account) {
    return { kind: "STUDENT", studentAccountId: account.id };
  }

  return null;
}

type StaffIdentity = Extract<Identity, { kind: "STAFF" }>;
type StudentIdentity = Extract<Identity, { kind: "STUDENT" }>;

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

/** Same as {@link asStaff}, but for handlers behind `requireStudent`. */
export function asStudent(identity: Identity): StudentIdentity {
  if (identity.kind !== "STUDENT") {
    throw new Error("Expected a student identity");
  }
  return identity;
}
