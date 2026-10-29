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

## Project layout

- `lib/competencies.ts`: competencies, sheet tabs, skills, rubrics, level ladders
- `lib/sheets.ts`: Apps Script fetch, sanitising, de-duplication
- `lib/report/`: parsing, structured-report normalising, browser store, PDF export
- `components/report/`: report UI (dossier, tabs, plan, audit)
- `app/`: routes (login, dashboard, one page per competency, admin)
