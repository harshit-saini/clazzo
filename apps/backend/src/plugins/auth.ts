import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
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
    requireStudent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (fastify) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");

  fastify.register(fastifyJwt, { secret });

  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: "Unauthorized" });
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

  fastify.decorate("requireStudent", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user.kind !== "STUDENT") {
      reply.code(403).send({ error: "Student access required" });
    }
  });
});
