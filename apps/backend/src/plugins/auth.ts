import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db.js";
import type { Identity } from "../auth/identity.js";

export type AuthPayload = Identity;

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthPayload;
    user: AuthPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireStaff: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireOwner: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireOwnerOrAccountant: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireStudent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (fastify) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");

  // Tokens expire so a leaked or long-forgotten one doesn't stay valid
  // forever; `authenticate` below closes the gap for the window before
  // that — an account deactivated (or a role changed) mid-lifetime.
  fastify.register(fastifyJwt, { secret, sign: { expiresIn: "24h" } });

  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    // A validly-signed, unexpired token only proves the caller once held
    // real credentials — it says nothing about whether the account behind
    // it is still active *right now*. Re-check against the DB on every
    // request so deactivating a staff member takes effect immediately
    // instead of only once their existing token happens to expire, and
    // refresh role/instituteId onto request.user so a role change (or, in
    // principle, an institute change) is live immediately too rather than
    // trusting whatever was true when the token was issued.
    const identity = request.user;
    if (identity.kind === "STAFF") {
      const user = await prisma.user.findUnique({ where: { id: identity.userId } });
      if (!user || !user.isActive) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      request.user = { kind: "STAFF", userId: user.id, instituteId: user.instituteId, role: user.role };
    } else {
      const account = await prisma.studentAccount.findUnique({ where: { id: identity.studentAccountId } });
      if (!account) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    }
  });

  fastify.decorate("requireStaff", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user.kind !== "STAFF") {
      reply.code(403).send({ error: "Staff access required" });
    }
  });

  fastify.decorate("requireOwner", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user.kind !== "STAFF" || request.user.role !== "OWNER") {
      reply.code(403).send({ error: "Owner access required" });
    }
  });

  fastify.decorate("requireOwnerOrAccountant", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user.kind !== "STAFF" || (request.user.role !== "OWNER" && request.user.role !== "ACCOUNTANT")) {
      reply.code(403).send({ error: "Owner or accountant access required" });
    }
  });

  fastify.decorate("requireStudent", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user.kind !== "STUDENT") {
      reply.code(403).send({ error: "Student access required" });
    }
  });
});
