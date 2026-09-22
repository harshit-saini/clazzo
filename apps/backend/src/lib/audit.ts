import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import type { Identity } from "../auth/identity.js";

interface LogAuditInput {
  actor: Identity | "SYSTEM";
  instituteId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records a sensitive action for later audit. Best-effort: a logging
 * failure is caught and swallowed (via console.error) rather than allowed
 * to fail the request it's attached to — the primary action already
 * succeeded by the time this is called.
 */
export async function logAudit({ actor, instituteId, action, entityType, entityId, metadata }: LogAuditInput) {
  const actorType = actor === "SYSTEM" ? "SYSTEM" : actor.kind;
  const actorId = actor === "SYSTEM" ? null : actor.kind === "STAFF" ? actor.userId : actor.studentAccountId;

  try {
    await prisma.auditLog.create({
      data: { instituteId, actorType, actorId, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue },
    });
  } catch (error) {
    console.error("[audit] failed to record log entry:", error);
  }
}
