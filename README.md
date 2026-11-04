# SkillLens — Technical Interview Reports

Students sign in with their email and see feedback from their technical interviews,
one page per competency:

- Frontend Development
- Programming with Problem Solving (DSA)
- Backend Development
- Software Engineering Fundamentals

Admins can look up any student at `/admin` and see internal audit notes.

## Setup

```bash
bun install
cp .env.example .env   # then fill in the values
bun dev                # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SHEETS_API_URL` | Apps Script `/exec` URL. The app adds `?email=…&sheets=…` per request. |
| `SESSION_SECRET` | Long random string used to sign session cookies. |
| `ADMIN_PASSWORD` | Password for the `/admin` dashboard. |
| `REPORT_REQUIRE_SHARED` | `true` hides a result until "Result shared with students status" is filled in. |
| `DATABASE_URL` | Postgres for user analytics (e.g. Neon). Required in production. Locally, without it, an embedded database is created in `.data/`. |

Generate a secret with `openssl rand -hex 32`.

## Production

```bash
bun run build
bun run start
```

Set the environment variables above on the host. They are never committed.

## How data flows

- The sheet API is called only on sign-in and when a student presses **Refetch**.
  The result is cached in the student's browser (localStorage) and every page renders from it.
- Before data reaches the browser, the server removes:
  - interviewer names, recording and transcript links, and audit fields
  - the JSON report's `internal_only` notes
  - feedback that hasn't been released yet
  - level and verdict band for students who didn't clear
- `/admin` fetches the full, unfiltered data on demand and never stores it in the browser.
- Reports can be downloaded as a PDF from each competency page.

## User analytics (`/admin/analytics`)

Admin-only. Tables live in their own `skilllens` Postgres schema and are created automatically.

- **Student ID**: a stable ID per email, created on first sign-in. Email is only for display.
- **Visit**: one per browser tab. A refresh continues the same visit.
- **Session**: shared across tabs. A new one starts after 30 minutes of inactivity.
- **Time spent**: counted only while the tab is visible and the student interacted in the last minute.
- **Also tracked**: page views, feedback report views (with viewing time), and every sign-in attempt (with failure reason).
- **Frequency**: based on active days in the last 30 days. 12 or more is Daily, 4–11 is Weekly, 1–3 is Occasionally.
- **Inactive**: no visit in 14 days.
- **Retention**: the share of students who visited again at least N days after their first visit.
- **Time zones**: timestamps are stored in UTC and displayed in IST. "Today" and date ranges follow IST days.

## Project layout

- `lib/competencies.ts`: competencies, sheet tabs, skills, rubrics, level ladders
- `lib/sheets.ts`: Apps Script fetch, sanitising, de-duplication
- `lib/report/`: parsing, structured-report normalising, browser store, PDF export
- `lib/analytics/`: event tracking (browser + server), roster, analytics calculations
- `lib/db.ts`: Postgres / embedded database and schema
- `components/report/`: report UI (dossier, tabs, plan, audit)
- `app/`: routes (login, dashboard, one page per competency, admin)
