# @clazzo/frontend

React + Vite + TypeScript. One app, three sections:

- **Marketing homepage** (`/`) — the public Clazzo landing page.
- **Staff dashboard** (`/dashboard/*`) — what coaching institute/school
  staff use day to day: students, batches, schedule, attendance, fees,
  grades, staff management. Requires a `STAFF` login.
- **Student portal** (`/portal/*`) — a student's view across every
  institute they belong to: grade, courses, teachers, schedule,
  attendance, fees. Requires a `STUDENT` login.

## Setup

```bash
cp .env.example .env   # point VITE_API_URL at the backend if not localhost:3001
npm run dev --workspace apps/frontend
```

Requires `@clazzo/backend` running (see `apps/backend/README.md`).

## Auth

`/login` is a single OTP flow shared by staff and students (the backend
resolves the email to whichever account owns it) — after verifying, it
redirects to `/dashboard` or `/portal` based on the returned identity kind.
`/register` creates an institute + owner; `/student/signup` creates a
standalone student account; `/consent/confirm` is where a guardian enters
the code emailed to them to activate a student's gated portal access.

`src/auth/AuthContext.tsx` holds the session (JWT in `localStorage`,
identity in memory, refreshed via `GET /api/auth/me`). `RequireAuth`
guards routes by identity kind and redirects to `/login` otherwise.

## Structure

- `src/lib/api.ts` — fetch wrapper: attaches the bearer token, throws
  `ApiError` on non-2xx, clears the token on 401.
- `src/components/` — shared UI (`AppShell`, `DataTable`, `Modal`,
  `FormField`, `StatCard`), built on the homepage's existing "Organic"
  design tokens (`src/styles/organic.css`) for visual consistency.
- `src/dashboard/`, `src/portal/` — each app's layout + pages, mounted
  under their route prefix in `App.tsx`.
