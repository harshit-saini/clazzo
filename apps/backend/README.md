# @clazzo/backend

Fastify + TypeScript API for the Clazzo operator dashboard — the app coaching
institutes and teachers use to manage students, attendance, fees and class
schedules. Students are optional platform users; teachers/institutes always
have access.

## Setup

```bash
cp .env.example .env   # then fill in DATABASE_URL and JWT_SECRET
npm install             # from the repo root
npm run db:migrate --workspace apps/backend
npm run dev --workspace apps/backend
```

## Auth

Passwordless — every account (staff and student) logs in with an emailed
one-time code, sent via [Resend](https://resend.com):

1. `POST /api/auth/otp/request { email }` — always returns the same generic
   message regardless of whether the email is registered (no account
   enumeration). Rate-limited per email (5 requests / 15 min, 60s between).
2. `POST /api/auth/otp/verify { email, code }` — returns a JWT scoped to
   whichever account owns the email (staff `User` or portal-enabled
   `Student`). Codes expire after 10 minutes, are single-use, and lock out
   after 5 wrong guesses.

`POST /api/auth/register` creates the institute + owner account, then sends
the owner their first OTP (there's no password, so verifying the code is
what proves they own the email and grants a session).

Without `RESEND_API_KEY` set, emails are logged to the console instead of
sent — useful for local dev.

## Data model

- **Institute** — the tenant. Every other model is scoped to one.
- **User** — a teacher or owner. Always has login access. `OWNER`s can manage staff.
- **Student** — managed by the institute. `portalEmail` is set once a teacher
  invites them (`POST /api/students/:id/invite`) — its presence alone means
  "has portal access"; there's no password to set.
- **Batch** — a course/section students enroll into.
- **ScheduleSlot** — a recurring weekly time (e.g. "Mon 5–6pm") for a batch.
- **ClassSession** — a concrete, dated occurrence generated from `ScheduleSlot`s;
  attendance is recorded against these.
- **Attendance** — one row per student per session.
- **FeeStructure** — a batch's default price/billing cycle.
- **FeeInvoice** / **FeePayment** — what a specific student owes, and the
  (possibly partial) payments recorded against it, each with a payment method.

## API

All routes except `/health` and `/api/auth/*` require
`Authorization: Bearer <token>` and are scoped to the caller's institute.
Staff-only routes (everything except `/api/auth`) reject student tokens
with 403 via `requireStaff`.

| Area | Routes |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/otp/request`, `POST /api/auth/otp/verify`, `GET /api/auth/me` |
| Staff | `GET/POST /api/staff`, `PATCH /api/staff/:id/deactivate` (owner only) |
| Students | `GET/POST /api/students`, `GET/PATCH/DELETE /api/students/:id`, `POST /api/students/:id/invite` |
| Batches | `GET/POST /api/batches`, `GET/PATCH/DELETE /api/batches/:id`, `POST /api/batches/:id/enroll`, `DELETE /api/batches/:id/enroll/:studentId` |
| Schedule | `GET/POST /api/batches/:batchId/schedule`, `DELETE /api/schedule/:slotId`, `POST /api/batches/:batchId/sessions/generate`, `GET /api/batches/:batchId/sessions`, `PATCH /api/sessions/:id` |
| Attendance | `GET/POST /api/sessions/:sessionId/attendance`, `GET /api/students/:studentId/attendance` |
| Fees | `PUT/GET /api/batches/:batchId/fee-structure`, `GET /api/invoices`, `GET/POST /api/students/:studentId/invoices`, `POST /api/invoices/:invoiceId/payments` |

## Notes

- `prisma.config.ts` (Prisma 7) holds the `DATABASE_URL`-driven datasource
  config; `prisma/schema.prisma` no longer embeds a connection string.
- Invoice `status` (`PENDING`/`PARTIAL`/`PAID`/`OVERDUE`) is derived
  automatically from the sum of its payments — see `src/lib/invoices.ts`.
