import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";

const registerSchema = z.object({
  instituteName: z.string().min(1),
  ownerName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.code(409).send({ error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(body.password);

    const institute = await prisma.institute.create({
      data: {
        name: body.instituteName,
        users: {
          create: {
            name: body.ownerName,
            email: body.email,
            passwordHash,
            role: "OWNER",
          },
        },
      },
      include: { users: true },
    });

    const owner = institute.users[0];
    const token = fastify.jwt.sign({ userId: owner.id, instituteId: institute.id, role: owner.role });

    return reply.code(201).send({
      token,
      user: { id: owner.id, name: owner.name, email: owner.email, role: owner.role },
      institute: { id: institute.id, name: institute.name },
    });
  });

  fastify.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.isActive || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const token = fastify.jwt.sign({ userId: user.id, instituteId: user.instituteId, role: user.role });

    return reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  fastify.get("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.userId } });
    if (!user) return reply.code(404).send({ error: "Not found" });
    return reply.send({ id: user.id, name: user.name, email: user.email, role: user.role, instituteId: user.instituteId });
  });
}
