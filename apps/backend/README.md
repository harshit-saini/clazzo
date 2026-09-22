# @clazzo/backend

Fastify + TypeScript API for Clazzo. Two sides:

- **Operator dashboard** — what coaching institutes and teachers use to
  manage students, attendance, fees and class schedules. Staff always have
  access.
- **Student portal** — a student creates one account (independent of any
  institute) and sees every school/coaching-center they've been invited to
  in one place: their grade, enrolled courses, teachers, schedule,
  attendance and fee status at each.

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
   whichever account owns the email (staff `User` or a `StudentAccount`).
   Codes expire after 10 minutes, are single-use, and lock out after 5
   wrong guesses.

Two ways to create an account, same login after that:

- `POST /api/auth/register { instituteName, ownerName, email }` — creates
  an institute + owner `User`.
- `POST /api/auth/student/signup { name, email }` — creates a standalone
  `StudentAccount`, not tied to any institute.

Neither takes a password — both send an OTP immediately after creating the
account, since verifying it is what proves the caller owns the email and
grants a session.

Without `RESEND_API_KEY` set, emails are logged to the console instead of
sent — useful for local dev.

## Data model

- **Institute** — the tenant. Most models are scoped to one.
- **User** — a teacher or owner. Always has login access. `OWNER`s can manage staff.
- **StudentAccount** — a student's global login identity (name, email).
  Independent of any institute — this is what OTP login resolves to.
- **Student** — a student's *membership* at one institute: their roster
  entry there (grade, enrollments, attendance, fees). Links to a
  `StudentAccount` via `studentAccountId`, set once a teacher invites them
  (`POST /api/students/:id/invite`) or resolved automatically if that email
  already has an account. A person with memberships at several institutes
  (a school and a coaching center, say) has one `StudentAccount` and one
  `Student` row per institute — all reachable from the same login.
- **Grade** — a structured grade/section within one institute (e.g. "Class
  7"). Both `Student` (a membership's current grade) and `Batch` (which
  grade a course belongs to) can reference one.
- **Batch** — a course/section students enroll into.
- **ScheduleSlot** — a recurring weekly time (e.g. "Mon 5–6pm") for a batch.
- **ClassSession** — a concrete, dated occurrence generated from `ScheduleSlot`s;
  attendance is recorded against these.
- **Attendance** — one row per student per session.
- **FeeStructure** — a batch's default price/billing cycle.
- **FeeInvoice** / **FeePayment** — what a specific student owes, and the
  (possibly partial) payments recorded against it, each with a payment method.

## API

Every route except `/health` and `/api/auth/*` requires
`Authorization: Bearer <token>`.

- **Staff routes** (`/api/staff`, `/api/students`, `/api/batches`,
  `/api/grades`, and everything under `/api` for schedule/attendance/fees)
  are scoped to the caller's institute and reject student tokens with 403
  via `requireStaff`.
- **Student routes** (`/api/student/*`) are scoped to the caller's
  `StudentAccount` and reject staff tokens with 403 via `requireStudent`.

| Area | Routes |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/student/signup`, `POST /api/auth/otp/request`, `POST /api/auth/otp/verify`, `GET /api/auth/me` |
| Staff | `GET/POST /api/staff`, `PATCH /api/staff/:id/deactivate` (owner only) |
| Students (staff-side roster) | `GET/POST /api/students`, `GET/PATCH/DELETE /api/students/:id`, `POST /api/students/:id/invite` |
| Grades | `GET/POST /api/grades`, `PATCH/DELETE /api/grades/:id` |
| Batches | `GET/POST /api/batches`, `GET/PATCH/DELETE /api/batches/:id`, `POST /api/batches/:id/enroll`, `DELETE /api/batches/:id/enroll/:studentId` |
| Schedule | `GET/POST /api/batches/:batchId/schedule`, `DELETE /api/schedule/:slotId`, `POST /api/batches/:batchId/sessions/generate`, `GET /api/batches/:batchId/sessions`, `PATCH /api/sessions/:id` |
| Attendance | `GET/POST /api/sessions/:sessionId/attendance`, `GET /api/students/:studentId/attendance` |
| Fees | `PUT/GET /api/batches/:batchId/fee-structure`, `GET /api/invoices`, `GET/POST /api/students/:studentId/invoices`, `POST /api/invoices/:invoiceId/payments` |
| Student portal | `GET /api/student/institutes` (every institute this student belongs to), `GET /api/student/institutes/:instituteId` (grade, courses, teachers, schedule, attendance summary, invoices), `GET /api/student/institutes/:instituteId/attendance` (full history) |

## Notes

- `prisma.config.ts` (Prisma 7) holds the `DATABASE_URL`-driven datasource
  config; `prisma/schema.prisma` no longer embeds a connection string.
- Invoice `status` (`PENDING`/`PARTIAL`/`PAID`/`OVERDUE`) is derived
  automatically from the sum of its payments — see `src/lib/invoices.ts`.
