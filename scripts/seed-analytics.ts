// Seeds dummy analytics data for trying out /admin/analytics.
//
//   bun run seed:analytics           add ~40 demo students with 45 days of activity (local PGlite)
//   bun run seed:analytics --clear   remove the demo students and everything recorded for them
//
// Demo students all use @demo.test emails, so they never collide with real ones and can be
// removed cleanly. By default this refuses to touch DATABASE_URL (the shared Neon database);
// pass --remote only if you really want demo rows there. Stop `bun dev` first: PGlite allows
// one process at a time.
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";

const DOMAIN = "@demo.test";
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const IST = 5.5 * 60 * 60 * 1000;

const args = new Set(process.argv.slice(2));
if (process.env.DATABASE_URL && !args.has("--remote")) {
  console.error("DATABASE_URL is set; refusing to seed the shared database. Run with DATABASE_URL= (or pass --remote).");
  process.exit(1);
}

// Deterministic randomness so every seed produces the same dataset.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const weighted = <T,>(xs: readonly [T, number][]) => {
  let r = rand() * xs.reduce((n, [, w]) => n + w, 0);
  for (const [x, w] of xs) if ((r -= w) < 0) return x;
  return xs[0][0];
};

const FIRST = ["Aarav", "Diya", "Rohan", "Ananya", "Vikram", "Sneha", "Arjun", "Priya", "Karthik", "Meera", "Rahul", "Kavya", "Siddharth", "Ishita", "Nikhil", "Pooja", "Aditya", "Riya", "Varun", "Lakshmi"];
const LAST = ["Sharma", "Reddy", "Iyer", "Patel", "Nair", "Gupta", "Rao", "Menon", "Singh", "Kumar"];
const COMPETENCIES = ["frontend-development", "dsa", "backend-development", "se-fundamentals"];
const SECTIONS = [["overview", 4], ["domains", 3], ["concepts", 2], ["plan", 2]] as const;
const DEVICES = [
  [["desktop", "Chrome", "Windows"], 30],
  [["desktop", "Chrome", "macOS"], 12],
  [["desktop", "Edge", "Windows"], 6],
  [["desktop", "Firefox", "Linux"], 3],
  [["mobile", "Chrome", "Android"], 28],
  [["mobile", "Safari", "iOS"], 10],
  [["mobile", "Samsung Internet", "Android"], 4],
  [["tablet", "Safari", "iOS"], 3],
] as const;
/** Visit cadence: chance of visiting on any given day. */
const PRACTICE: Record<string, string[]> = {
  "frontend-development": ["Todo List with Local Storage", "Debounced Search Input", "Responsive Navbar – Flexbox", "Star Rating Component – React"],
  dsa: ["Join Words in Sentence – Arrays & Strings", "Two Sum – Hashing", "Merge Intervals – Sorting", "Valid Parentheses – Stacks"],
  "backend-development": ["Paginated REST API – Express", "JWT Auth Middleware", "SQL Joins – Orders & Customers"],
  "se-fundamentals": ["Git Merge Conflicts", "HTTP Status Codes Quiz", "Process vs Thread"],
};
const PROFILES = [[0.75, 5], [0.25, 12], [0.06, 15], [0, 4]] as const;

/** A time on the given day at an IST hour weighted towards evenings. */
function atIstHour(day: number): number {
  const hour = weighted([[9, 1], [11, 2], [14, 2], [17, 3], [19, 4], [21, 5], [23, 2]] as [number, number][]) + int(0, 1);
  const istMidnight = Math.floor((day + IST) / DAY) * DAY - IST;
  return istMidnight + hour * 60 * MIN + int(0, 59) * MIN;
}

async function main() {
  const d = await db();
  const now = Date.now();
  const ts = (ms: number) => new Date(Math.min(ms, now)).toISOString();

  await d.exec("BEGIN");
  // Clear previous demo rows first so re-seeding is idempotent.
  const demo = `(SELECT id FROM skilllens.students WHERE email LIKE '%${DOMAIN}')`;
  for (const table of ["practice_clicks", "report_section_time", "report_views", "page_views", "visits", "sessions", "reports"]) {
    await d.query(`DELETE FROM skilllens.${table} WHERE student_id IN ${demo}`);
  }
  await d.query(`DELETE FROM skilllens.logins WHERE email LIKE '%${DOMAIN}'`);
  await d.query(`DELETE FROM skilllens.students WHERE email LIKE '%${DOMAIN}'`);
  if (args.has("--clear")) {
    await d.exec("COMMIT");
    await d.close();
    console.log("Removed demo analytics data.");
    return;
  }

  const counts = { students: 0, reports: 0, sessions: 0, visits: 0, reportViews: 0, practiceClicks: 0, logins: 0 };
  for (let i = 0; i < 40; i++) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
    const email = `${name.toLowerCase().replace(" ", ".")}${i}${DOMAIN}`;
    const joined = now - int(3, 45) * DAY;
    const [{ id }] = await d.query<{ id: string }>(
      `INSERT INTO skilllens.students (email, name, created_at) VALUES ($1, $2, $3) RETURNING id`,
      [email, name, ts(joined)],
    );
    counts.students++;

    const comps = [...COMPETENCIES].sort(() => rand() - 0.5).slice(0, int(1, 4));
    const reports = comps.map((c) => ({ key: `demo:${i}:${c}`, competency: c }));
    for (const r of reports) {
      const published = joined - int(0, 5) * DAY;
      const date = new Date(published - 2 * DAY + IST);
      await d.query(
        `INSERT INTO skilllens.reports (report_key, student_id, competency, interview_date, published_at, first_recorded_at, last_recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [r.key, id, r.competency, `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`, ts(published), ts(joined)],
      );
      counts.reports++;
    }

    const rate = weighted(PROFILES.map(([p, w]) => [p, w] as [number, number]));
    const device = weighted(DEVICES as unknown as [readonly [string, string, string], number][]);
    for (let day = joined; day < now; day += DAY) {
      // Everyone visits on the day they first sign in, unless they never came back at all.
      if (!(day === joined && rate > 0) && rand() >= rate) continue;
      const [deviceType, browser, os] = rand() < 0.85 ? device : weighted(DEVICES as unknown as [readonly [string, string, string], number][]);
      const start = atIstHour(day);
      if (start > now) continue;
      const sessionId = randomUUID();
      let sessionMs = 0;
      let cursor = start;
      // Visits reference their session, so it goes in first; totals are filled in at the end.
      await d.query(
        `INSERT INTO skilllens.sessions (id, student_id, started_at, last_seen_at, device_type, browser, os) VALUES ($1, $2, $3, $3, $4, $5, $6)`,
        [sessionId, id, ts(start), deviceType, browser, os],
      );

      if (day === joined || rand() < 0.3) {
        if (rand() < 0.15) {
          await d.query(
            `INSERT INTO skilllens.logins (student_id, email, success, reason, occurred_at, device_type, browser, os) VALUES ($1, $2, false, 'invalid_email', $3, $4, $5, $6)`,
            [id, email, ts(cursor - MIN), deviceType, browser, os],
          );
          counts.logins++;
        }
        await d.query(
          `INSERT INTO skilllens.logins (student_id, email, success, occurred_at, device_type, browser, os) VALUES ($1, $2, true, $3, $4, $5, $6)`,
          [id, email, ts(cursor), deviceType, browser, os],
        );
        counts.logins++;
      }

      const visitCount = rand() < 0.2 ? 2 : 1;
      for (let v = 0; v < visitCount; v++) {
        const visitId = randomUUID();
        const visitStart = cursor;
        let visitMs = int(20, 120) * 1000;
        await d.query(
          `INSERT INTO skilllens.page_views (student_id, session_id, visit_id, path, occurred_at) VALUES ($1, $2, $3, '/', $4)`,
          [id, sessionId, visitId, ts(visitStart)],
        );

        // Most visits open one or two reports and read a few tabs.
        const opened = rand() < 0.8 ? int(1, Math.min(2, reports.length)) : 0;
        for (let o = 0; o < opened; o++) {
          const r = pick(reports);
          const viewId = randomUUID();
          const openedAt = visitStart + visitMs;
          let viewMs = 0;
          await d.query(
            `INSERT INTO skilllens.page_views (student_id, session_id, visit_id, path, occurred_at) VALUES ($1, $2, $3, $4, $5)`,
            [id, sessionId, visitId, `/${r.competency}`, ts(openedAt)],
          );
          await d.query(
            `INSERT INTO skilllens.report_views (id, student_id, session_id, competency, report_key, opened_at, last_seen_at) VALUES ($1, $2, $3, $4, $5, $6, $6)`,
            [viewId, id, sessionId, r.competency, r.key, ts(openedAt)],
          );
          for (const [section, weight] of SECTIONS) {
            if (section !== "overview" && rand() > weight / 4) continue;
            const ms = int(15, 60 * weight) * 1000 * (rate > 0.5 ? 2 : 1);
            await d.query(
              `INSERT INTO skilllens.report_section_time (report_view_id, student_id, section, active_ms, first_seen_at, last_seen_at) VALUES ($1, $2, $3, $4, $5, $6)`,
              [viewId, id, section, ms, ts(openedAt + viewMs), ts(openedAt + viewMs + ms)],
            );
            viewMs += ms;
          }
          await d.query(`UPDATE skilllens.report_views SET active_ms = $2, last_seen_at = $3 WHERE id = $1`, [viewId, viewMs, ts(openedAt + viewMs)]);
          // Some students open practice questions from the prep plan.
          for (let q = rand() < 0.4 ? int(1, 3) : 0; q > 0; q--) {
            const question = pick(PRACTICE[r.competency]);
            await d.query(
              `INSERT INTO skilllens.practice_clicks (student_id, session_id, report_view_id, competency, report_key, question, link, week, clicked_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [id, sessionId, viewId, r.competency, r.key, question, `https://learning.ccbp.in/question/demo-${PRACTICE[r.competency].indexOf(question)}`, int(1, 4), ts(openedAt + viewMs)],
            );
            counts.practiceClicks++;
          }
          visitMs += viewMs;
          counts.reportViews++;
        }

        await d.query(
          `INSERT INTO skilllens.visits (id, student_id, session_id, started_at, last_seen_at, active_ms, entry_path) VALUES ($1, $2, $3, $4, $5, $6, '/')`,
          [visitId, id, sessionId, ts(visitStart), ts(visitStart + visitMs), visitMs],
        );
        counts.visits++;
        sessionMs += visitMs;
        cursor = visitStart + visitMs + int(1, 10) * MIN;
      }

      await d.query(`UPDATE skilllens.sessions SET last_seen_at = $2, active_ms = $3 WHERE id = $1`, [sessionId, ts(cursor), sessionMs]);
      counts.sessions++;
    }
  }

  // Failed sign-ins from emails that aren't students.
  for (let i = 0; i < 12; i++) {
    const [deviceType, browser, os] = weighted(DEVICES as unknown as [readonly [string, string, string], number][]);
    await d.query(
      `INSERT INTO skilllens.logins (email, success, reason, occurred_at, device_type, browser, os) VALUES ($1, false, $2, $3, $4, $5, $6)`,
      [`unknown${i}${DOMAIN}`, pick(["no_interview_found", "no_interview_found", "invalid_email", "service_unavailable"]), ts(atIstHour(now - int(0, 30) * DAY)), deviceType, browser, os],
    );
    counts.logins++;
  }

  await d.exec("COMMIT");
  await d.close();
  console.log("Seeded demo analytics:", counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
