// Analytics database. Uses Postgres from DATABASE_URL (e.g. Neon); without it, local
// development falls back to an embedded Postgres (PGlite) stored in .data/.
// All tables live in their own "skilllens" schema so they never clash with other apps sharing
// the database. All timestamps are stored as timestamptz (UTC).

export type Db = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
  /** Flushes and closes the connection (scripts, graceful shutdown). */
  close(): Promise<void>;
};

const SCHEMA = `
SET client_min_messages TO WARNING;
CREATE SCHEMA IF NOT EXISTS skilllens;

CREATE TABLE IF NOT EXISTS skilllens.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Published feedback reports, recorded when their student signs in or refetches.
CREATE TABLE IF NOT EXISTS skilllens.reports (
  report_key text PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES skilllens.students(id),
  competency text NOT NULL,
  interview_date text NOT NULL DEFAULT '',
  published_at timestamptz,
  first_recorded_at timestamptz NOT NULL DEFAULT now(),
  last_recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_student_idx ON skilllens.reports (student_id);

CREATE TABLE IF NOT EXISTS skilllens.sessions (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES skilllens.students(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  active_ms bigint NOT NULL DEFAULT 0,
  device_type text NOT NULL DEFAULT 'desktop',
  browser text NOT NULL DEFAULT 'Other',
  os text NOT NULL DEFAULT 'Other'
);
CREATE INDEX IF NOT EXISTS sessions_student_idx ON skilllens.sessions (student_id, started_at);

CREATE TABLE IF NOT EXISTS skilllens.visits (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES skilllens.students(id),
  session_id uuid NOT NULL REFERENCES skilllens.sessions(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  active_ms bigint NOT NULL DEFAULT 0,
  entry_path text NOT NULL DEFAULT '/'
);
CREATE INDEX IF NOT EXISTS visits_student_idx ON skilllens.visits (student_id, started_at);
CREATE INDEX IF NOT EXISTS visits_started_idx ON skilllens.visits (started_at);

CREATE TABLE IF NOT EXISTS skilllens.page_views (
  id bigserial PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES skilllens.students(id),
  session_id uuid NOT NULL,
  visit_id uuid NOT NULL,
  path text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_views_student_idx ON skilllens.page_views (student_id, occurred_at);

CREATE TABLE IF NOT EXISTS skilllens.report_views (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES skilllens.students(id),
  session_id uuid NOT NULL,
  competency text NOT NULL,
  report_key text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  active_ms bigint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS report_views_student_idx ON skilllens.report_views (student_id, opened_at);
CREATE INDEX IF NOT EXISTS report_views_key_idx ON skilllens.report_views (report_key);

-- Active time per report tab (Executive Summary, Domain Evaluations, Concept Mastery, Prep Plan).
CREATE TABLE IF NOT EXISTS skilllens.report_section_time (
  report_view_id uuid NOT NULL REFERENCES skilllens.report_views(id),
  student_id uuid NOT NULL REFERENCES skilllens.students(id),
  section text NOT NULL,
  active_ms bigint NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_view_id, section)
);
CREATE INDEX IF NOT EXISTS report_section_time_student_idx ON skilllens.report_section_time (student_id);

CREATE TABLE IF NOT EXISTS skilllens.logins (
  id bigserial PRIMARY KEY,
  student_id uuid REFERENCES skilllens.students(id),
  email text NOT NULL,
  success boolean NOT NULL,
  reason text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  device_type text NOT NULL DEFAULT 'desktop',
  browser text NOT NULL DEFAULT 'Other',
  os text NOT NULL DEFAULT 'Other'
);
CREATE INDEX IF NOT EXISTS logins_occurred_idx ON skilllens.logins (occurred_at);
`;

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    // prepare: false keeps it compatible with pooled connections (Neon, PgBouncer).
    const sql = postgres(url, { max: 5, idle_timeout: 20, prepare: false, onnotice: () => {} });
    return {
      query: async <T,>(text: string, params: unknown[] = []) =>
        (await sql.unsafe(text, params as never[])) as unknown as T[],
      exec: async (text: string) => {
        await sql.unsafe(text);
      },
      close: async () => {
        await sql.end();
      },
    };
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL must be set in production for analytics");

  const [{ PGlite }, { mkdir }] = await Promise.all([import("@electric-sql/pglite"), import("node:fs/promises")]);
  await mkdir("./.data", { recursive: true });
  const pg = await PGlite.create("./.data/analytics");
  return {
    query: async <T,>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
    exec: async (text: string) => {
      await pg.exec(text);
    },
    close: async () => {
      await pg.close();
    },
  };
}

// One connection per server process; survives dev hot reloads. The schema is re-applied
// whenever its text changes (all statements are IF NOT EXISTS), so a running dev server
// picks up new tables without a restart.
const globalDb = globalThis as unknown as {
  __analyticsConn?: Promise<Db>;
  __analyticsReady?: { schema: string; promise: Promise<Db> };
};

export function db(): Promise<Db> {
  if (globalDb.__analyticsReady?.schema === SCHEMA) return globalDb.__analyticsReady.promise;

  globalDb.__analyticsConn ??= connect().catch((error) => {
    globalDb.__analyticsConn = undefined;
    throw error;
  });
  const promise = globalDb.__analyticsConn
    .then(async (d) => {
      await d.exec(SCHEMA);
      return d;
    })
    .catch((error) => {
      globalDb.__analyticsReady = undefined;
      throw error;
    });
  globalDb.__analyticsReady = { schema: SCHEMA, promise };
  return promise;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
