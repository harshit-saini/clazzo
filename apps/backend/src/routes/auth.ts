import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { resolveIdentityByEmail } from "../auth/identity.js";
import { issueOtpForEmail } from "../auth/issueOtp.js";
import { isOtpRequestAllowed } from "../auth/rateLimit.js";
import { MAX_OTP_ATTEMPTS, hashOtpCode } from "../auth/otp.js";

const registerSchema = z.object({
  instituteName: z.string().min(1),
  ownerName: z.string().min(1),
  email: z.string().email().transform((e) => e.toLowerCase()),
});

const otpRequestSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
});

const otpVerifySchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  code: z.string().length(6),
});

const GENERIC_OTP_SENT_MESSAGE = "If that email is registered, a login code has been sent.";

export default async function authRoutes(fastify: FastifyInstance) {
  // Creates the institute + owner account, then sends a login code to the
  // same address — there's no password, so verifying the OTP is what
  // actually proves the caller owns the email and grants a session.
  fastify.post("/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await resolveIdentityByEmail(body.email);
    if (existing) {
      return reply.code(409).send({ error: "An account with this email already exists" });
    }

    await prisma.institute.create({
      data: {
        name: body.instituteName,
        users: {
          create: { name: body.ownerName, email: body.email, role: "OWNER" },
        },
      },
    });

    await issueOtpForEmail(body.email);

    return reply.code(201).send({ message: GENERIC_OTP_SENT_MESSAGE });
  });

  fastify.post("/otp/request", async (request, reply) => {
    const { email } = otpRequestSchema.parse(request.body);

    if (!isOtpRequestAllowed(email)) {
      return reply.code(429).send({ error: "Too many requests. Please wait a minute and try again." });
    }

    const identity = await resolveIdentityByEmail(email);
    if (identity) {
      await issueOtpForEmail(email);
    }

    // Always the same response, whether or not the email is registered.
    return reply.send({ message: GENERIC_OTP_SENT_MESSAGE });
  });

  fastify.post("/otp/verify", async (request, reply) => {
    const { email, code } = otpVerifySchema.parse(request.body);

    const otp = await prisma.otpCode.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!otp || otp.expiresAt < new Date()) {
      return reply.code(401).send({ error: "Invalid or expired code" });
    }

    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      return reply.code(401).send({ error: "Too many incorrect attempts. Request a new code." });
    }

    if (otp.codeHash !== hashOtpCode(code)) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      return reply.code(401).send({ error: "Invalid or expired code" });
    }

    const identity = await resolveIdentityByEmail(email);
    if (!identity) {
      // The account was deleted/deactivated between requesting and verifying the code.
      return reply.code(401).send({ error: "Invalid or expired code" });
    }

    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    const token = fastify.jwt.sign(identity);
    return reply.send({ token, identity });
  });

  fastify.get("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    if (request.user.kind === "STAFF") {
      const user = await prisma.user.findUnique({ where: { id: request.user.userId } });
      if (!user) return reply.code(404).send({ error: "Not found" });
      return reply.send({
        kind: "STAFF",
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        instituteId: user.instituteId,
      });
    }

    const student = await prisma.student.findUnique({ where: { id: request.user.studentId } });
    if (!student) return reply.code(404).send({ error: "Not found" });
    return reply.send({
      kind: "STUDENT",
      id: student.id,
      name: student.name,
      email: student.portalEmail,
      instituteId: student.instituteId,
    });
  });
}
