import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { resolveIdentityByEmail } from "../auth/identity.js";
import { issueOtpForEmail } from "../auth/issueOtp.js";
import { isOtpRequestAllowed } from "../auth/rateLimit.js";
import { verifyOtpCode } from "../auth/verifyOtp.js";
import { ORG_TEMPLATES } from "../lib/orgStructure.js";

const registerSchema = z.object({
  instituteName: z.string().min(1),
  ownerName: z.string().min(1),
  email: z.string().email().transform((e) => e.toLowerCase()),
  type: z.enum(["SCHOOL", "COLLEGE", "COACHING", "TUTOR"]).default("COACHING"),
  // The structure ladder chosen in the registration wizard — a template
  // as-is, a customized one, or [] for "decide later." Optional so older
  // or direct API callers still get a sensible default (see ORG_TEMPLATES).
  levels: z.array(z.string().trim().min(1).max(60)).max(6).optional(),
});

const studentSignupSchema = z.object({
  name: z.string().min(1),
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

    // The registration wizard always sends the ladder it wants (a template,
    // a customized one, or [] for "decide later"); only a caller that omits
    // levels entirely falls back to the type's default template.
    const levelNames = body.levels ?? ORG_TEMPLATES[body.type] ?? [];

    await prisma.institute.create({
      data: {
        name: body.instituteName,
        type: body.type,
        users: {
          create: { name: body.ownerName, email: body.email, role: "OWNER" },
        },
        orgLevels: {
          create: levelNames.map((name, depth) => ({ name, depth })),
        },
      },
    });

    await issueOtpForEmail(body.email);

    return reply.code(201).send({ message: GENERIC_OTP_SENT_MESSAGE });
  });

  // Self-service: a student creates their own account (independent of any
  // institute), then gets invited into one or more institutes by email —
  // whichever order that happens in, the email is what links them together.
  fastify.post("/student/signup", async (request, reply) => {
    const body = studentSignupSchema.parse(request.body);

    const existing = await resolveIdentityByEmail(body.email);
    if (existing) {
      return reply.code(409).send({ error: "An account with this email already exists" });
    }

    await prisma.studentAccount.create({ data: { name: body.name, email: body.email } });
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

    const result = await verifyOtpCode(email, code);
    if (!result.ok) return reply.code(401).send({ error: result.error });

    const identity = await resolveIdentityByEmail(email);
    if (!identity) {
      // The account was deleted/deactivated between requesting and verifying the code.
      return reply.code(401).send({ error: "Invalid or expired code" });
    }

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

    const account = await prisma.studentAccount.findUnique({ where: { id: request.user.studentAccountId } });
    if (!account) return reply.code(404).send({ error: "Not found" });
    return reply.send({
      kind: "STUDENT",
      id: account.id,
      name: account.name,
      email: account.email,
    });
  });
}
