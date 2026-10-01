# Clazzo — UI/UX Improvement Plan

_Audit date: 1 October 2026 · Scope: staff dashboard, student/parent portal, auth & onboarding, marketing site, PWA_

This is a fresh audit of the code as it stands after PR #10 (13 "Fix Now" items) and PR #11 (15 "Next" items). Nothing already shipped in those PRs is repeated here.

It was produced by four independent reviews (visual design system, staff workflows, accessibility/mobile/PWA, portal/auth/marketing). Their findings were merged and de-duplicated. The headline claims were then re-checked against the code: grep counts, reading the backend logic, and computed styles in a headless browser. File paths are relative to `apps/frontend/src` unless they start with `backend/`.

**How to read this:** every item has the **problem** (what's wrong today, with evidence) and the **change** (what to build, and where). Effort is **S** (≤ half a day), **M** (1–3 days) or **L** (a week or more). 🛠 marks items that need backend work.

---

## Summary

| # | Improvement | Area | Effort |
|---|---|---|---|
| **P0 — Broken today or loses data** | | | |
| 1 | Unpaid invoices never become "Overdue" 🛠 | Fees | S |
| 2 | Teachers can't reach past classes to mark them | Attendance | S–M |
| 3 | Signup → login sends a second code that cancels the first | Auth | S |
| 4 | Opening the app offline logs the user out | PWA / Auth | S |
| 5 | Marked attendance is lost if the save fails | Attendance | M |
| 6 | Link-styled buttons go invisible on hover; nav "Sign up" is unreadable | Visual | S |
| 7 | Marketing CTAs and legal links go nowhere (`href="#"`) | Marketing | S |
| 8 | Teachers/accountants can change any group's timetable 🛠 | Permissions | S |
| 9 | Guardian consent can get permanently stuck 🛠 | Portal / Auth | M |
| 10 | iOS zooms into every form field | Mobile | S |
| **P1 — High value** | | | |
| 11 | Attendance screen built for a phone | Attendance | M |
| 12 | Login-code step: resend, countdown, autofill, paste | Auth | S–M |
| 13 | Let people edit records (most can only be created/deleted) 🛠 | Workflows | S–M |
| 14 | Bulk add, import and enrol students 🛠 | Students | M–L |
| 15 | Generate a month's invoices for a whole group 🛠 | Fees | M |
| 16 | Fees page: filters, sorting, pagination, inline "Record payment" 🛠 | Fees | M |
| 17 | Attendance reporting for staff (student + group) 🛠 | Attendance | S–M |
| 18 | Role-aware home page and navigation | IA | S–M |
| 19 | Global search; search by phone; filter students by group 🛠 | IA | S–M |
| 20 | Marketing copy promises features that don't exist | Marketing | M |
| 21 | Privacy, consent wording and revocation for minors' data 🛠 | Trust / Compliance | M–L |
| 22 | Explain session expiry and return the user to where they were | Auth | S |
| 23 | Muted/secondary text and selected states fail contrast | Accessibility | S–M |
| 24 | Pending-consent card is a dead link; pending institutes look empty 🛠 | Portal | S–M |
| 25 | Portal "Today / next class" and filterable attendance history 🛠 | Portal | M |
| 26 | Remove leftover Font Awesome files (≈1.7 MB precached); fix font loading | PWA / Perf | S |
| **P2 — Improvements** | | | |
| 27 | Split the overloaded group (Unit) page into tabs | IA | M |
| 28 | Faster term setup: copy timetables, holidays, cancel sessions 🛠 | Scheduling | M |
| 29 | Accessible, dismissible toasts | Accessibility | S |
| 30 | Move focus to the page heading on navigation; finish page titles | Accessibility | S |
| 31 | Mobile drawer still tabbable when closed; no close button | Accessibility | S |
| 32 | Table semantics and row-specific action labels | Accessibility | S |
| 33 | Respect reduced-motion everywhere; fix weak focus styles | Accessibility | S |
| 34 | PWA install prompt, manifest shortcuts, iOS status bar | PWA | S |
| 35 | Profile & settings page (name, email, institute name/logo) 🛠 | Account | M |
| 36 | Parents with more than one child 🛠 | Portal | S / L |
| 37 | Plain-language errors and less jargon | Copy | S |
| 38 | Announce auth step changes to screen readers | Accessibility | S |
| 39 | Lighter registration; progress indicator for invite → consent | Onboarding | S–M |
| 40 | "Needs attention" badges on portal institute cards 🛠 | Portal | S |
| **P3 — Design system & polish** | | | |
| 41 | Semantic tokens + utility classes; cut 355 inline style blocks | Design system | L |
| 42 | One `PageHeader` component for all 14 pages | Design system | M |
| 43 | One modal footer layout | Design system | S |
| 44 | Button size and variant scale (incl. destructive ghost) | Design system | S |
| 45 | Card padding, radius and icon-size scale | Design system | M |
| 46 | Missing hover/affordance states | Visual | S |
| 47 | Actually use the spacing tokens and heading scale | Design system | M |
| 48 | Merge duplicate components (pills, StatCard type, `grid-3`) | Design system | S |
| 49 | Brand/logo should link home | Navigation | S |
| 50 | Bring the marketing site and the app into one visual language | Visual | M |
| 51 | Dark-mode readiness | Design system | L |
| 52 | Bigger tap targets in the marketing mobile nav | Mobile | S |

**Suggested first sprint:** 1, 2, 3, 4, 6, 7, 8, 10 (all S) → 5, 9 → 11, 12, 13.

---

## P0 — Broken today or loses data

### 1. Unpaid invoices never become "Overdue" 🛠
**Problem.** `backend/src/lib/invoices.ts` → `recalculateInvoiceStatus()` is the only code that ever sets `OVERDUE`, and it's only called when a payment is recorded (`backend/src/routes/fees.ts:136`). An invoice nobody has paid stays `PENDING` forever after its due date. So the "Overdue" filter on the Fees page, the overdue chip in `FeeSummaryStrip`, and the red Overdue tags never show the people who actually owe money. That's the accountant's main question.

**Change.**
- Work out overdue when reading. In `GET /api/invoices`, `GET /api/students/:id` and the dashboard summary, treat `status = PENDING AND dueDate < now()` as `OVERDUE`. Make the `?status=OVERDUE` filter use the same condition.
- Or add a daily job (cron, or a check on startup) that flips the stored status.
- Add a test: an unpaid invoice with yesterday's due date is returned as `OVERDUE`.

**Effort:** S

### 2. Teachers can't reach past classes to mark them
**Problem.** The dashboard lists only *today's* sessions. The other way in is the "Class sessions" table on a group's page. That table does `sessions.filter(s => s.status === "SCHEDULED").slice(0, 10)` (`dashboard/pages/UnitDetailPage.tsx:491`) over a list the API returns **oldest first** (`backend/src/routes/schedule.ts`, `orderBy date asc`). Marking attendance never changes a session's status, so the table shows the first 10 sessions ever generated. A couple of weeks into term, yesterday's class can't be reached at all. Teachers also see sessions for subjects they don't teach, and opening one returns 403.

**Change.**
- **Quick fix:** in `SessionsSection`, request `?from=<today − 7 days>`, sort around today, and stop filtering on `SCHEDULED`. For teachers, hide sessions they don't teach.
- **Proper fix 🛠:** add a "My classes" view. Generalise `GET /api/dashboard/today` to accept `?date=` or `?from&to&unmarked=1`, keeping the teacher scoping. Add "Yesterday / Last 7 days / Unmarked" chips on the dashboard.

**Effort:** S (quick fix) · M (My classes)

### 3. Signup → login sends a second code that cancels the first
**Problem.** `/register` and `/student/signup` already email a login code (`backend/src/routes/auth.ts:59, :90`), and the success screen says "Check your email for a login code". But "Go to login" opens `LoginPage` on the *email* step. The user presses "Send login code" again, and `issueCode()` (`backend/src/auth/issueOtp.ts`) issues a new code and marks the first one used. A new user who types the code from the first email gets "Invalid or expired code". This is the first thing every new owner and self-signup student sees.

**Change.**
- In `RegisterInstitutePage` and `StudentSignupPage`, navigate with `state: { email, step: "code" }`.
- In `LoginPage`, read `step` and start on the code-entry step, with a "Didn't get it? Resend" link.
- Or put the code input straight onto the signup success screen.

Frontend only.

**Effort:** S

### 4. Opening the app offline logs the user out
**Problem.** In `auth/AuthContext.tsx`, `refresh()` calls `/api/auth/me` and on **any** error runs `setToken(null)` (lines 45–47). That includes no network, a timeout, or the server being down. A teacher who opens the installed PWA in a classroom with weak signal is logged out. Logging back in needs both signal *and* an email round-trip.

**Change.**
- Only clear the token when the error is an `ApiError` with `status === 401`.
- On network errors, keep the token and identity (cache the last `/me` result in `localStorage`), set an `offline` flag, and retry when the `online` event fires.
- Show a small "You're offline — changes will sync when you reconnect" banner in `AppShell`.

**Effort:** S

### 5. Marked attendance is lost if the save fails
**Problem.** On `AttendanceMarkPage`, the draft only exists in React state. If the save fails (no signal), the error is a plain `<p>` with no `role="alert"`, sitting below a long roster where nobody sees it. Navigating away, reloading, or the service worker auto-updating throws away 30+ taps. Unmarked students also default to PRESENT in the draft, so "already saved" and "never marked" look the same.

**Change.**
- Save the draft to `localStorage` under the `sessionId` key on every change, restore it on load, and clear it after a successful save.
- On a network error, keep the draft queued, show "Saved on this device — will sync when you're back online", and retry on `online`. Workbox `BackgroundSyncPlugin` is the fuller option.
- Add `role="alert"` to the save error and scroll it into view.
- Add a "previously saved" marker on rows that came back from the server with a status.
- Warn before leaving with unsaved changes.

**Effort:** M

### 6. Link-styled buttons go invisible on hover; nav "Sign up" is unreadable
**Problem.** Checked with computed styles in a browser:
- `a:hover { color: var(--color-accent-900) }` is more specific than `.btn-primary`. Any `<a class="btn btn-primary">` on hover renders `#402310` text on a `#643312` background, which is effectively invisible. When pressed (`:active`, accent-900 background) it's 1:1.
- `.nav a { color: inherit }` also beats `.btn-primary`, so the marketing nav "Sign up" button is dark text (`#201e1d`) on `#8c491a`, about 2.4:1.

Affected: nav Sign up (`sections/Nav.tsx`), hero CTA (`sections/Hero.tsx`), "Go home" on the 404 page, pricing CTAs, and every `<Link className="btn …">`.

**Change.** In `styles/organic.css`, scope the plain-link rules to links that aren't buttons: `a:not(.btn)`, `a:not(.btn):hover`, `.nav a:not(.btn)`. Also give each button variant an explicit `color` on `:hover` and `:active`.

**Effort:** S

### 7. Marketing CTAs and legal links go nowhere
**Problem.** There are 10 `href="#"` links in `sections/Hero.tsx`, `Pricing.tsx`, `Categories.tsx` and `Footer.tsx`. They include "Register Your Coaching Center", "Find a Coaching Center", every pricing "Get started", every category chip, social icons, and **Terms/Privacy**. The Newsletter "Subscribe" button has no handler. The nav's "Features" target is an empty section, and there's no student/parent entry point from the site at all.

**Change.**
- Owner CTAs → `<Link to="/register">`; student CTA → `/student/signup`; add a "Log in" link for parents.
- Remove the Categories chips, or turn them into anchors to real content.
- Hide the Newsletter until there's a backend, or wire it up.
- Add real `/privacy`, `/terms` and `/contact` routes in `App.tsx` (see #21).

**Effort:** S (links) · M (legal pages)

### 8. Teachers/accountants can change any group's timetable 🛠
**Problem.** In `backend/src/routes/schedule.ts`, creating and deleting schedule slots, generating sessions, and `PATCH /sessions/:id` (lines 51, 73, 86, 160) only check `requireStaff`. Every other structural change is owner-only. `UnitDetailPage` passes no `canManage` to `ScheduleSection` or `SessionsSection`, so teachers and accountants *see* the "Add slot", "Remove" and "Generate sessions" controls, and the API accepts them.

**Change.**
- Backend: add `{ preHandler: fastify.requireOwner }` to the slot and generate mutations. Allow a teacher to cancel or modify only sessions of courses they teach.
- Frontend: pass `canManage={isOwner}` to `ScheduleSection` and `SessionsSection` and hide the forms and Remove buttons.

**Effort:** S

### 9. Guardian consent can get permanently stuck 🛠
**Problem.**
- Consent codes expire after 10 minutes (`backend/src/auth/otp.ts`, `OTP_TTL_MS`).
- There's no resend anywhere. `ConsentConfirmPage` has none, and `backend/src/routes/consent.ts` only exposes `POST /confirm`.
- Staff can't re-invite either: the Invite button only shows while `!s.studentAccountId` (`StudentsPage.tsx:98`), and the first invite sets that field.
- Consent codes and login codes share the `OtpCode` table with no "purpose" field, so a new login code for the same email silently cancels a pending consent code.
- So a parent who opens the email an hour later is locked out, and the student's card says "Waiting on your guardian" forever.

**Change.**
- Schema: add `purpose` (`LOGIN | CONSENT`) to `OtpCode`, and only cancel codes with the same purpose. Give consent codes 24–72 h.
- Backend: add `POST /api/students/:id/resend-consent` (owner) and a public, rate-limited `POST /api/consent/request { email }`.
- Frontend: "Resend to guardian" on `StudentsPage` and `StudentDetailPage`; "Send me a new code" on `ConsentConfirmPage`.

**Effort:** M

### 10. iOS zooms into every form field
**Problem.** `.input` is 14px. Ladder inputs are 14.5px and 13px. iOS Safari zooms the page when a field under 16px gets focus, and in an installed PWA the zoom often stays afterwards. This affects every iPhone user on every form: login, add student, record payment.

**Change.** In `styles/organic.css`, add `@media (max-width: 860px) { .input, .ladder-input, .ladder-insert-open input { font-size: 16px; } }`.

**Effort:** S

---

## P1 — High value

### 11. Attendance screen built for a phone
**Problem.** This is the most-used screen (several times a day per teacher, mostly on phones):
- The four options per student are all-caps segments about 34px tall. They wrap on a 360px screen and the pill shape clips the corners.
- The "Mark all" row has no `flexWrap`. With `overflow-x: hidden` on `body`, its last button gets cut off.
- The selected option is cream on the base orange (3.03:1). Its focus ring is the same orange as its background, so it's invisible.
- There's no running tally. Save is only at the bottom.
- After saving, `navigate(-1)` can drop someone who came from a deep link out of the app.

**Change.**
- Below 640px, render each row's options as a full-width 4-column grid with `min-height: 44px` and single-letter labels (P / A / L / E), keeping the full word in `aria-label`.
- Selected state: `--color-accent-700` background with a `--color-text` focus outline (2px offset).
- Add `flexWrap: "wrap"` to the Mark all row.
- Add a sticky bottom bar: "28 P · 2 A · 0 L — Save attendance" (`position: sticky; bottom: env(safe-area-inset-bottom)`).
- Keyboard: P / A / L / E sets the focused row and moves to the next one.
- After saving, go to `/dashboard` (or the group page) instead of `navigate(-1)`.
- Add `useDocumentTitle("Mark attendance")`.

**Effort:** M

### 12. Login-code step: resend, countdown, autofill, paste
**Problem.**
- `LoginPage` has no "Resend code" button. The only way out is "Use a different email". Re-requesting within 60 s returns "Too many requests" with no countdown (`backend/src/routes/auth.ts:99-101`).
- No input in the app uses `autoComplete="one-time-code"`, so iOS/Android don't offer the code from the email.
- `maxLength={6}` cuts a pasted `123 456` down to `123 45`.
- `ConsentConfirmPage`'s code field has no `pattern`, so a short code reaches the backend and comes back as the raw "Validation failed".

**Change.**
- Both code pages:
  - `autoComplete="one-time-code"`, `inputMode="numeric"`;
  - `onChange` strips non-digits and slices to 6 characters (drop `maxLength`);
  - a "Resend code" button with a 60-second countdown;
  - check "Enter all 6 digits" before submitting.
- Email inputs: add `autoComplete="email"`. Name fields: `name` / `organization`.
- Optional 🛠: return distinct `expired` / `wrong` / `locked` errors plus the number of attempts left.

**Effort:** S–M

### 13. Let people edit records 🛠
**Problem.** These `PATCH` endpoints already exist, but the UI never calls them: `PATCH /api/students/:id`, `PATCH /api/courses/:id` and `PATCH /api/structure/units/:id`. Today, fixing a student's phone or name, changing a subject's teacher, or renaming a section means deleting and recreating it. Schedule slots, invoices and staff roles have no edit endpoint at all.

**Change.**
- **No backend needed:**
  - an "Edit" modal on `StudentDetailPage` (name, phone, guardian);
  - a teacher `<Select>` on `CourseDetailPage` and on the subject rows in `UnitDetailPage`;
  - "Rename" in `StructurePage`'s `UnitNode` actions.
- **🛠 New endpoints:** `PATCH /api/schedule/:slotId`; invoice edit and void (`PATCH /api/invoices/:id`, status `CANCELLED`); `PATCH /api/staff/:id` for role changes.

**Effort:** S (existing endpoints) · M (new ones)

### 14. Bulk add, import and enrol students 🛠
**Problem.** Adding 30 students to a section takes roughly 270 clicks and keystrokes:
- `AddStudentModal` closes after each save and can't assign a group.
- Enrolling is a separate trip per student: Structure → section → pick from an unfiltered `<select>` → Enroll.
- The picker only loads `take=500`, so in a large institute newer students can't be found at all.

**Change.**
- `AddStudentModal`: add a "Group" field and a "Save & add another" button.
- Roster: replace the `<select>` with a searchable multi-select. 🛠 Make `POST /api/structure/units/:id/enroll` accept `studentIds[]`.
- 🛠 CSV/paste import (name, phone, guardian name/phone/email, group): `POST /api/students/bulk` with a preview → confirm step and per-row errors.

**Effort:** M (multi-select + modal) · L (CSV import)

### 15. Generate a month's invoices for a whole group 🛠
**Problem.** Invoices can only be created one student at a time from `StudentDetailPage`; `FeesPage` has no create action. A monthly run for a 30-student batch is about 180 interactions. Each group already stores a fee structure (amount, billing cycle, `dueDayOfMonth`), but nothing uses it, and `dueDayOfMonth` isn't even in the form.

**Change.**
- 🛠 `POST /api/units/:unitId/invoices/generate { period }`. It should cover the group and everything inside it, use the fee structure's amount and due day, and skip students already invoiced for that period.
- UI: a "Generate invoices" button in the group's Fee structure section and on `FeesPage`. Show a preview (N students, ₹ total, M skipped), then confirm.
- Add `dueDayOfMonth` to `FeeStructureSection`.

**Effort:** M

### 16. Fees page: filters, sorting, pagination, inline "Record payment" 🛠
**Problem.** The Fees page offers only a status dropdown. `GET /api/invoices` returns every invoice, unpaginated. `DataTable` can't sort. To record a payment, the accountant has to open the student and come back.

**Change.**
- 🛠 `GET /api/invoices`: add `orgUnitId`, `from`/`to` (due date), `search`, and `take`/`skip` (return `{ items, total }`).
- `FeesPage`: add a group picker, a month picker, search and pagination, plus an inline "Record payment" button that reuses `RecordPaymentModal`.
- `DataTable`: optional `sortable` columns, with `aria-sort` on the headers.

**Effort:** M

### 17. Attendance reporting for staff 🛠
**Problem.** Staff can't see attendance over time anywhere. `StudentDetailPage` shows groups, electives and fees, but no attendance, even though `GET /api/students/:studentId/attendance` already exists. It also fetches the guardian's name and phone but never shows them, so a teacher chasing an absence can't find the parent's number.

**Change.**
- `StudentDetailPage`: an Attendance section (overall % with `AttendanceTag`, per-subject %, last 20 sessions) using the existing endpoint, and a Guardian contact block (name, `tel:` phone link, email).
- 🛠 `GET /api/units/:id/attendance-summary?from&to`: weekly % trend plus the lowest-attendance students. Show it on the group page.

**Effort:** S (student view) · M (group trend)

### 18. Role-aware home page and navigation
**Problem.** Every role gets the same home page. Accountants land on "Not yet marked" and today's classes, which they can't act on. Teachers see "Outstanding dues" and "Collected this month". The nav hides only Fees, and only for teachers. Teachers still get Structure (groups they don't teach return 404) and Staff. Accountants get Structure, Subjects and Staff.

**Change.**
- Branch `DashboardHome` on role:
  - **Teacher:** "My classes today", unmarked past sessions (#2), my subjects.
  - **Accountant:** overdue list, due this week, collected this month, a link to generate invoices.
  - **Owner:** current view.
- In `DashboardLayout`, extend `hideFor` per role: Staff → owner only; Fees → owner/accountant; Subjects/Structure → hidden for accountants.
- For teachers, filter the Structure tree to the groups they teach.

**Effort:** S–M

### 19. Global search; search by phone; filter students by group 🛠
**Problem.** There's no search outside the Students page. Search matches **name only** (`backend/src/routes/students.ts:61`), so a parent calling from their phone number can't be found. The backend already supports `GET /api/students?orgUnitId=`, but the Students page has no group filter.

**Change.**
- 🛠 Extend `search` to also match `phone`, `guardianPhone` and `guardianEmail`.
- `StudentsPage`: add a group `<Select>` (with an "include sub-groups" checkbox).
- `AppShell`: add a search box, or a Ctrl/⌘+K command palette, across students, groups and subjects.

**Effort:** S (filter + phone) · M (palette)

### 20. Marketing copy promises features that don't exist
**Problem.** The site sells a marketplace that isn't built:
- "The coaching marketplace" (`Hero.tsx:46`); "compare … read real reviews … enroll online" (`Hero.tsx:92-93`).
- "Reviews & ratings", "Demo classes", "Online payment", "Verified centers" (`StudentFeatures.tsx:8-12`).
- "Compare / Join — enroll and pay online" (`HowItWorks.tsx:11-12`).
- FAQ answers about messaging and paid enrolment (`data.ts`), pricing tiers selling search placement, and stats/testimonials that read as invented.

None of this exists in the backend. The copy also only talks about coaching centres, but the product supports schools, colleges and solo tutors.

**Change.** Rewrite `Hero`, `HowItWorks`, `CenterFeatures`, `StudentFeatures`, `Pricing`, and the FAQ data in `data.ts` around what ships today:
- flexible structure for all four org types;
- attendance on a phone;
- fees and dues;
- a multi-institute student/parent portal;
- guardian consent.

Remove the invented numbers and testimonials, or label them as examples.

**Effort:** M

### 21. Privacy, consent wording and revocation for minors' data 🛠
**Problem.** The product holds data about minors, but:
- the consent email and page never say what's shared, with whom, or how to withdraw;
- there's no privacy policy to link to;
- there's no revoke flow;
- self-signup doesn't ask about age, so a minor who signs up alone and is invited without a guardian email goes live with `consentStatus: NOT_REQUIRED`.

For an India-focused product (₹ pricing), this is a DPDP Act exposure.

**Change.**
- Add `/privacy` and `/terms` pages, and link them from the footer, signup and the consent email/page.
- Consent page and email: "What [Institute] will be able to see / what you'll see / how to withdraw".
- 🛠 `POST /api/consent/revoke`.
- Signup: "Are you under 18?" → require a guardian email.

**Effort:** M–L (needs a decision from you on policy)

### 22. Explain session expiry and return the user to where they were
**Problem.** Sessions last 24 h. On any 401, `lib/api.ts` clears the session and `RequireAuth` redirects to `/login` with no message. There's no "from" location, so after logging in the user always lands on `/dashboard` or `/portal`, and anything half-typed is lost.

**Change.**
- `setUnauthorizedHandler` records a reason.
- `RequireAuth` redirects with `state: { from: location, reason: "expired" }`.
- `LoginPage` shows "Your session expired — log in again to continue" and navigates back to `from` after verifying.

**Effort:** S

### 23. Muted/secondary text and selected states fail contrast
**Problem.** The Fix Now pass fixed buttons and links, but not these (WCAG ratios, computed):

| Used for | Pair | Ratio (AA needs 4.5) |
|---|---|---|
| Breadcrumbs, `.text-muted`, table-scroll hint, many subtitles | text @ 55% | 3.45–3.58 |
| Table headers (11px uppercase), sidebar email, fee strip labels, pagination | text @ 60% | 3.97–4.14 |
| `.card-meta` | text @ 50% | 3.0–3.1 |
| **Active sidebar item**, **selected attendance option** | cream on `--color-accent` | 3.03 |
| `.card-kicker`, `.tag-outline` | accent on bg/surface | 2.7–3.3 |
| `.tree-meta`, EmptyState text | neutral-600 on surface | 3.21 |
| `.ladder-insert` | neutral-500 | 2.2–2.4 |

There are 55 hand-mixed `color-mix(var(--color-text) N%)` values across six different percentages, and `.text-muted` is used 0 times.

**Change.**
- Add `--color-text-muted` (≈ 70% mix, or `--color-neutral-700`, ≈ 5.4:1) and replace all 55 inline mixes with it, or with `.text-muted`.
- Use `--color-accent-700` for the active nav, the selected `.seg-opt`, `.card-kicker` and `.tag-outline`.
- Use neutral-700 for `.tree-meta`, EmptyState and `.ladder-insert`.

**Effort:** S (tokens) · M (replacing all call sites)

### 24. Pending-consent card is a dead link; pending institutes look empty 🛠
**Problem.**
- `PortalHome.tsx:36` renders a pending membership as a `<Link to="#">`. It's focusable, announced as a link, and does nothing.
- The student isn't told which guardian email was used or what to do next.
- Opening a pending institute directly shows "Not placed in a group yet / No subjects yet / No invoices yet", which reads as "you're not enrolled".
- The attendance page shows the raw 403 text with a pointless Retry button.

**Change.**
- Render the pending card as a `<div>`.
- Show the masked guardian email ("a•••@gmail.com", 🛠 return it from `/api/student/institutes`), "Ask them to check their inbox", and a Resend button (#9).
- Add a pending banner to `InstituteDetailPage` and `AttendanceHistoryPage` instead of empty states or errors.

**Effort:** S–M

### 25. Portal "Today / next class" and filterable attendance history 🛠
**Problem.** "When's my next class?" is the main reason a student opens the app, but the portal only lists raw 24-hour times on each subject card. There's no cross-institute "Today" view, and cancelled sessions aren't shown. Attendance history:
- returns every row with no pagination;
- has no subject or month filter;
- shows raw enums (`PRESENT`/`LATE`);
- never explains that LATE counts as present.

**Change.**
- 🛠 `GET /api/student/upcoming` (next 7 days across institutes, including cancellations) → a "Today & this week" section at the top of `PortalHome`.
- `AttendanceHistoryPage`: subject and month filters, pagination (🛠 `take`/`skip`), styled status tags, and a one-line legend.
- Format times with `toLocaleTimeString` (12-hour where the locale expects it).

**Effort:** M

### 26. Remove leftover Font Awesome files; fix font loading
**Problem.**
- `apps/frontend/public/fonts/` holds an unused Font Awesome 5.13 set: `.eot`, `.ttf`, `.woff`, `.woff2` and `.svg`, about 2.8 MB. Nothing in `src` references it.
- Its `README.md` describes a different "Blockchain Explorer" project. It arrived in the same commit as the earlier malware cleanup. The font files themselves are stock and contain no scripts, but they're leftovers from that repo.
- Because `vite.config.ts:14` precaches `**/*.svg`, the three SVG fonts (≈ 1.7 MB) are downloaded on every install. The last build reported **2,046 KiB precached for a ~300 KB app**.
- Google Fonts is pulled in through a CSS `@import` (render-blocking chain, no `preconnect`, not cached for offline use).

**Change.**
- Delete `public/fonts/`.
- Self-host the Caprasimo and Figtree `woff2` files, or add `<link rel="preconnect">` in `index.html` plus a Workbox `CacheFirst` runtime route for `fonts.gstatic.com`.
- Optionally narrow `globPatterns` so precaching is opt-in.

**Effort:** S

---

## P2 — Improvements

### 27. Split the overloaded group (Unit) page into tabs
**Problem.** `UnitDetailPage` stacks six sections on one scrolling page: children, Subjects + form, the full roster + enrol form, Weekly schedule + form, Sessions + generate form, and Fee structure. In a 40-student section the schedule sits about 40 rows down the page.

**Change.** Use tabs: **Overview** (children, counts, today's sessions), **Students**, **Subjects & timetable**, **Sessions & attendance**, **Fees**. Keep the active tab in the URL (`?tab=`) so it can be linked and survives a refresh. Collapse the roster by default.

**Effort:** M

### 28. Faster term setup: copy timetables, holidays, cancel sessions 🛠
**Problem.**
- Schedule slots are added one at a time per section; six subjects over five days is 30 submits per section.
- There's no "copy from 12A".
- "Generate sessions" runs one group at a time and asks for the dates every time.
- `PATCH /api/sessions/:id` can cancel a session but isn't exposed, so a holiday's sessions stay "Not yet marked / Overdue" forever.

**Change.**
- Multi-day checkboxes on the slot form, or a days × periods grid editor.
- 🛠 "Copy timetable from…" (another group).
- 🛠 "Generate for this group and everything inside it".
- Remember the last date range.
- "Cancel session" on session rows.
- 🛠 "Mark holiday" for a date across the institute.

**Effort:** M

### 29. Accessible, dismissible toasts
**Problem.** `components/ToastContext.tsx:34` puts every toast in one `role="status" aria-live="polite"` region, so errors aren't announced urgently. Toasts disappear after 3.5 s or 6 s with no close button and no pause on hover or focus (WCAG 2.2.1). The stack ignores the iOS safe-area inset, and the entrance animation ignores reduced-motion.

**Change.**
- Use two regions: errors in `role="alert"`, successes in `polite`.
- Errors stay until dismissed and get a close (×) button; pause timers on hover or focus.
- `bottom: calc(16px + env(safe-area-inset-bottom))`.

**Effort:** S

### 30. Move focus to the page heading on navigation; finish page titles
**Problem.** After a client-side navigation, focus stays on the clicked link, so screen readers announce nothing. `useDocumentTitle` is still missing on six routes: AttendanceMark, portal AttendanceHistory, Login, Register, StudentSignup and ConsentConfirm.

**Change.**
- In `AppShell`, on a `location.pathname` change, focus the page `<h1>` (give it `tabIndex={-1}`), or `#main-content` as a fallback.
- Add `useDocumentTitle` to the six pages.

**Effort:** S

### 31. Mobile drawer still tabbable when closed; no close button
**Problem.**
- The closed drawer is only moved off-screen with `translateX(-100%)`, so keyboard and screen-reader users can still tab into the invisible menu.
- When it's open, there's no close button inside it. The scrim isn't focusable, and the toggle still says "Open menu".
- The marketing `.nav-toggle` and the FAQ buttons have no `aria-expanded`.

**Change.**
- On mobile, add `inert` (or `visibility: hidden`) to the sidebar while it's closed.
- Add a labelled "Close menu" button inside the drawer, and flip the toggle's label.
- Add `aria-expanded`/`aria-controls` to the marketing toggle and the FAQ buttons.

**Effort:** S

### 32. Table semantics and row-specific action labels
**Problem.**
- 9 `DataTable` columns use `header: ""`, so screen readers announce a blank column.
- Row actions all share the same name: "Remove, button" × 30 with no context.
- `DataTable` renders no `<caption>`, no `scope="col"`, and no row header.
- Pagination doesn't announce the new range.

**Change.**
- `DataTable`:
  - add a `caption` prop (it can be visually hidden);
  - add `scope="col"` to headers;
  - render the `primary` column as `<th scope="row">`;
  - render empty headers as `<span class="sr-only">Actions</span>`.
- Add ``aria-label={`Remove ${name}`}`` and the same pattern on every row action.
- Wrap the "1–50 of N" text in `aria-live="polite"`.

**Effort:** S

### 33. Respect reduced-motion everywhere; fix weak focus styles
**Problem.**
- Only `.skeleton-line` respects `prefers-reduced-motion`. The drawer slide, the toasts, the tree chevron rotation and the row transitions don't.
- `:focus { outline: none }` removes outlines anywhere `:focus-visible` doesn't apply.
- `.ladder-input:focus` is only a 1.5px orange underline (2.7:1).
- The ladder editor's Add/Cancel buttons are about 23px tall.

**Change.**
- Add a global `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }`.
- Give `.ladder-input:focus-visible` the standard 2px outline.
- Give the ladder buttons `min-height: 32px`.

**Effort:** S

### 34. PWA install prompt, manifest shortcuts, iOS status bar
**Problem.**
- There's no `beforeinstallprompt` handler and no iOS "Add to Home Screen" hint. This is a phone-first app that most users will never install.
- `index.html:11` uses `black-translucent`, which draws white status-bar text over the cream page, so the clock and battery are near-invisible.
- The manifest has no `shortcuts`, no `screenshots`, and no 192px maskable icon.

**Change.**
- Add an `InstallPrompt` component: on Android/Chrome, capture `beforeinstallprompt`; on iOS Safari, show a dismissible "Share → Add to Home Screen" card. Remember the dismissal.
- Set the iOS status bar style to `default`.
- In `vite.config.ts`, add `shortcuts` ("Today's classes", "Students"), two screenshots, and a 192px maskable icon.

**Effort:** S

### 35. Profile & settings page 🛠
**Problem.** There's nowhere to change your name or email, or for an owner to fix the institute name typed at signup or add a logo. The FAQ even mentions "account settings". `AppShell` only offers Log out.

**Change.**
- 🛠 `PATCH /api/auth/me` (name; an email change is re-verified with a code) and `PATCH /api/institute` (name, logo upload).
- A Settings page in both shells, linked from the user block in the sidebar.

**Effort:** M

### 36. Parents with more than one child 🛠
**Problem.**
- Inviting two siblings at the same school under the parent's email reuses one student account. There's no unique constraint on (account, institute), so `PortalHome` renders two cards with the same React `key`, and the detail page's `findFirst` only ever shows one child.
- Guardians have no account of their own.
- The consent success message counts memberships rather than children, and names nobody.

**Change.**
- **Short term:** block a second same-institute invite for an existing account with a clear message, and name the child and institute on the consent success screen.
- **Long term:** a guardian identity with a child switcher in the portal (schema + portal work).

**Effort:** S (short term) · L (guardian accounts)

### 37. Plain-language errors and less jargon
**Problem.**
- The auth pages don't use `fieldErrors()`, so validation shows as "Validation failed".
- A 409 on student signup ("account already exists") offers no "Log in instead" link.
- Self-signup students with no institutes are told to give "this email" without the email being shown.
- The School template's first level is "Center", which a single-campus school won't recognise.
- The copy mixes "center" and "centre".

**Change.**
- Wire `fieldErrors` into the four auth pages.
- Map 409 to "Already registered — [Log in]".
- Show the actual email in the portal empty state.
- Make the School template start at "Class", with "Add a campus level" offered as an option.
- Pick one spelling (the "centre" form suits the Indian market).

**Effort:** S

### 38. Announce auth step changes to screen readers
**Problem.** `LoginPage` (email → code), `RegisterInstitutePage`, `StudentSignupPage` and `ConsentConfirmPage` (form → "check your email" / success) swap their content with no announcement. Form-level error `<p>`s aren't announced either.

**Change.** Wrap the swapped content in `aria-live="polite"`, give the form-level errors `role="alert"`, and move focus to the new step's heading.

**Effort:** S

### 39. Lighter registration; progress indicator for invite → consent
**Problem.**
- Registration defaults to "Use a template" and shows the full level-ladder editor before the user has even logged in.
- The invite → signup/login → guardian consent flow spans several emails and pages, with no "step X of Y".

**Change.**
- Default to a template preview (read-only ladder + "Customise" link), with editing moved to the first-run Structure checklist step.
- Add a small `Steps` component on the student signup, login (when arriving from an invite) and consent pages.

**Effort:** S–M

### 40. "Needs attention" badges on portal institute cards 🛠
**Problem.** Portal institute cards show only the subject count, so a parent has to open each one to find an overdue fee or low attendance.

**Change.** 🛠 Add `overdueAmount` and `attendancePct` to `/api/student/institutes`. Show a red "₹X overdue" tag or an amber "Attendance 62%" tag on the card.

**Effort:** S

---

## P3 — Design system & polish

### 41. Semantic tokens + utility classes; cut 355 inline style blocks
**Problem.** There are **355** `style={{…}}` blocks across 39 files, against 169 `className=` uses. Inline styles can't have hover/focus states, can't respond to media queries (which is why `organic.css` needs `!important` overrides), and can't be themed. Repeated patterns:
- the form-error paragraph (about 21 copies);
- the inline form row (`flex, gap 10, align-items flex-end`);
- the marketing container `maxWidth: 1200` (×10);
- section padding `88px 0` (×7);
- page title sizes (×28).

**Change.**
- Add classes: `.form-error`, `.inline-form`, `.container`, `.section`, `.page-title`, `.section-title`, `.text-muted`, `.eyebrow`.
- Migrate the heaviest files first: `UnitDetailPage` (34), `Hero` (27), `StructurePage` (19), `InstituteDetailPage` (19), `DashboardHome`, `Pricing`, `Testimonials`.

**Effort:** L (do it incrementally)

### 42. One `PageHeader` component for all 14 pages
**Problem.** There are six different page-header patterns:
- title + action;
- title + subtitle;
- breadcrumb + title + subtitle (no action slot);
- title only;
- a "← Back" link on AttendanceHistory;
- Structure's "Edit levels" button inside a paragraph, with "Add" on a separate row.

Margins vary between 4, 6, 20, 24 and 28px, so the primary action moves from page to page.

**Change.** Add `components/PageHeader.tsx` (`breadcrumbs?`, `title`, `subtitle?`, `actions?`) and `SectionHeader` (h2 + action). Replace the hand-rolled headers on all 14 pages.

**Effort:** M

### 43. One modal footer layout
**Problem.** Five form modals put a full-width primary button inside the body and a lone "Close" below it (`StudentsPage` ×2, `StaffPage`, `StudentDetailPage` ×2). `StructurePage` and `ConfirmModal` use the `actions` slot instead. The dismiss button says "Close" rather than "Cancel", and comes after the primary button.

**Change.** Move all form modals to `actions` with `form="…"` ids. Order the footer Cancel → primary (primary on the right). Rename "Close" to "Cancel" for forms. Drop `btn-block` from modals.

**Effort:** S

### 44. Button size and variant scale
**Problem.**
- 17 of 20 `btn-ghost` uses override `fontSize: 13`.
- `height: 36` is set inline 6 times.
- "Mark all" buttons are about 27px tall.
- Destructive triggers (Remove, Archive, Deactivate) look exactly like "Add" and "Mark attendance".
- All buttons use the heavy Caprasimo display font, even 13px row actions.

**Change.**
- Add `.btn-sm` and `.btn-lg`, and make 13px the `btn-ghost` default.
- Add `.btn-ghost-danger` for destructive row actions.
- Use the body font (Figtree 600) for `.btn-sm` and `.btn-ghost`.
- Remove the inline overrides.

**Effort:** S

### 45. Card padding, radius and icon-size scale
**Problem.**
- Cards override their padding with eight different values (10/16, 14/18, 20, 22, 26, 28, 32, 36).
- The effective card radius (32.2px) isn't a token, and there are hard-coded radii of 12, 32 and 48px.
- Pricing and Testimonials put surface-coloured cards on surface-coloured sections, so the cards have no edge.
- Icons come in nine sizes (11–26px), and the 2.75 stroke looks heavy at small sizes.

**Change.**
- Add `.card-sm`, `.card-md` and `.card-lg` padding sizes and a `--radius-card` token.
- Add a `.list-row` class for row-style cards.
- Give cards inside surface sections the `--color-bg` background.
- Standardise icons on 16 / 20 / 24px, with a lighter stroke under 16px.

**Effort:** M

### 46. Missing hover/affordance states
**Problem.**
- Sidebar links are styled with an inline function, so they have no hover state.
- Footer links set their colour inline, so hover does nothing.
- The hero student CTA has no hover.
- Portal institute cards (which are links) don't react to hover.
- Closed FAQ items show no "+" marker.
- `.btn-primary:hover` still darkens disabled buttons.

**Change.**
- Move the sidebar links to a `.side-nav-link` class with `:hover` and `[aria-current="page"]` states.
- Add `.card-link:hover` (lift + border).
- Show a +/– marker on the FAQ items.
- Scope the hover rules with `:not(:disabled)`.

**Effort:** S

### 47. Actually use the spacing tokens and heading scale
**Problem.**
- `--space-1…8` are used once in TSX, against 322 inline pixel values for margin, padding and gap.
- The CSS heading scale (h1 42px … h4 20px) is overridden inline everywhere: h1 is 26px ×13 and 22px ×6, h2 is 18px ×15, and there are 22 distinct inline font sizes.

**Change.**
- Define an app type scale: `.page-title` 26px, `.section-title` 18px, `.auth-title` 22px.
- Replace the inline sizes as part of #41/#42.
- Map common gaps (8/12/16/24) to `--space-*`.

**Effort:** M

### 48. Merge duplicate components
**Problem.**
- `.tag` and `.tree-level-pill` are two separate pill systems.
- `StatCard` hand-rolls typography that `.card-kicker` / `.card-title` already define.
- `DashboardHome` uses `className="grid-3"` on a 5-column grid, relying on `!important` media queries meant for the marketing grids.

**Change.**
- Make the level pill a `.tag` variant (`.tag-level`).
- Build `StatCard` on the card typography classes.
- Add a dedicated `.stat-grid` with its own breakpoints (5 → 3 → 2 → 1 columns).

**Effort:** S

### 49. Brand/logo should link home
**Problem.** "Clazzo" is plain text in the sidebar, the marketing nav, the footer, and four auth pages.

**Change.** Wrap the brand in a `Link`: to `/dashboard` or `/portal` inside the app, and to `/` elsewhere.

**Effort:** S

### 50. Bring the marketing site and the app into one visual language
**Problem.**
- The marketing site hand-rolls an "eyebrow" label 7 times, and uses `clamp()` headings, tinted panels and 88px sections. The app uses flat cards and fixed 26px titles, so it feels like a different product after login.
- The app's main area is capped at 1100px and left-aligned, leaving a large empty strip on wide screens.
- Fees are a table for staff but cards in the portal.

**Change.**
- Share `.eyebrow`, the title classes and the card styles between the two.
- Centre the app main area, or let it grow to about 1280px.
- Pick one fee presentation and reuse it in both apps.

**Effort:** M

### 51. Dark-mode readiness
**Problem.**
- There's no `prefers-color-scheme` support or theme attribute.
- `--color-divider` and the shadows are hard-coded hex values.
- `.btn-danger` and `.toast` hard-code `#fff`.
- `theme-color` is fixed in `index.html`.
- There are no semantic tokens (on-accent, border, muted text, raised surface).

**Change.**
- Add a semantic token layer: `--color-on-accent`, `--color-border`, `--color-text-muted`, `--color-surface-raised`.
- Point the components at those tokens.
- Then add a `[data-theme="dark"]` block and a toggle.

This depends on #23 and #41.

**Effort:** L

### 52. Bigger tap targets in the marketing mobile nav
**Problem.** The open mobile nav menu's links are bare 14px text, about 22px tall. The toggle is about 34px.

**Change.** In the mobile media query, give `.nav-links-open a` `padding: 12px 0` (≥ 44px rows) and the toggle 44 × 44px.

**Effort:** S

---

_Prepared from the current `main` (commit `cd9feed`). Line numbers were checked at the time of writing and may shift as the code changes._
