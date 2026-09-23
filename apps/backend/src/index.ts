import "dotenv/config";
import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";

import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import staffRoutes from "./routes/staff.js";
import studentRoutes from "./routes/students.js";
import batchRoutes from "./routes/batches.js";
import scheduleRoutes from "./routes/schedule.js";
import attendanceRoutes from "./routes/attendance.js";
import feeRoutes from "./routes/fees.js";
import gradeRoutes from "./routes/grades.js";
import studentPortalRoutes from "./routes/studentPortal.js";
import consentRoutes from "./routes/consent.js";
import dashboardRoutes from "./routes/dashboard.js";

const app = Fastify({ logger: true });

app.setErrorHandler((error: FastifyError | ZodError, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "Validation failed", issues: error.issues });
  }
  app.log.error(error);
  const statusCode = error.statusCode ?? 500;
  return reply.code(statusCode).send({ error: statusCode === 500 ? "Internal server error" : error.message });
});

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

await app.register(cors, { origin: allowedOrigins });
await app.register(authPlugin);

app.get("/health", async () => ({ status: "ok" }));

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(staffRoutes, { prefix: "/api/staff" });
await app.register(studentRoutes, { prefix: "/api/students" });
await app.register(batchRoutes, { prefix: "/api/batches" });
await app.register(scheduleRoutes, { prefix: "/api" });
await app.register(attendanceRoutes, { prefix: "/api" });
await app.register(feeRoutes, { prefix: "/api" });
await app.register(gradeRoutes, { prefix: "/api/grades" });
await app.register(studentPortalRoutes, { prefix: "/api/student" });
await app.register(consentRoutes, { prefix: "/api/consent" });
await app.register(dashboardRoutes, { prefix: "/api/dashboard" });

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
