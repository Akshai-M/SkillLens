import { createHmac, timingSafeEqual } from "node:crypto";
import { cacheLife } from "next/cache";
import { cookies } from "next/headers";

const COOKIE_NAME = "cr_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** `id` is the analytics student ID; sessions created before analytics existed don't have it. */
export type Session = { email: string; name: string; exp: number; id?: string };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): Session | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

/** Reads and verifies the session cookie. Use in Server Actions. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? decode(token) : null;
}

/**
 * Same as getSession, for rendering. The private cache scope lets the expiry check
 * use Date.now() while the per-session shell is prerendered, and keeps the result
 * out of any server-side cache.
 */
export async function readSession(): Promise<Session | null> {
  "use cache: private";
  cacheLife("minutes");
  return getSession();
}

export async function createSession(email: string, name: string, id?: string): Promise<void> {
  const token = encode({ email, name, id, exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

// ---- Admin session -------------------------------------------------------

const ADMIN_COOKIE = "cr_admin";
const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * viewer: look up student reports only.
 * full:   student reports plus user analytics.
 */
export type AdminRole = "viewer" | "full";

type AdminSession = { admin: true; role: AdminRole; exp: number };

const ADMIN_ACCOUNTS: { role: AdminRole; userVar: string; passVar: string }[] = [
  { role: "full", userVar: "ADMIN_USERNAME", passVar: "ADMIN_PASSWORD" },
  { role: "viewer", userVar: "ADMIN_VIEWER_USERNAME", passVar: "ADMIN_VIEWER_PASSWORD" },
];

function decodeAdmin(token: string): AdminSession | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(`admin:${payload}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as AdminSession;
    const validRole = session.role === "viewer" || session.role === "full";
    return session.admin === true && validRole && session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function sameSecret(given: string, expected: string): boolean {
  const a = createHmac("sha256", secret()).update(given).digest();
  const b = createHmac("sha256", secret()).update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Role for a username/password pair from the env-configured admin accounts, or null. */
export function checkAdminCredentials(username: string, password: string): AdminRole | null {
  for (const account of ADMIN_ACCOUNTS) {
    const user = process.env[account.userVar];
    const pass = process.env[account.passVar];
    if (!user || !pass || pass.length < 8) continue;
    // Check both fields every time so timing doesn't reveal which one was wrong.
    const userOk = sameSecret(username.trim().toLowerCase(), user.trim().toLowerCase());
    const passOk = sameSecret(password, pass);
    if (userOk && passOk) return account.role;
  }
  return null;
}

export function adminAccountsConfigured(): boolean {
  return ADMIN_ACCOUNTS.some((a) => process.env[a.userVar] && process.env[a.passVar]);
}

export async function createAdminSession(role: AdminRole): Promise<void> {
  const payload = Buffer.from(JSON.stringify({ admin: true, role, exp: Date.now() + ADMIN_MAX_AGE_SECONDS * 1000 })).toString("base64url");
  (await cookies()).set(ADMIN_COOKIE, `${payload}.${sign(`admin:${payload}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE_SECONDS,
  });
}

/** Signed-in admin's role, or null. For Server Actions and request-time code. */
export async function getAdminRole(): Promise<AdminRole | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return (token && decodeAdmin(token)?.role) || null;
}

/** For rendering (see readSession for why this is a private cache scope). */
export async function readAdminRole(): Promise<AdminRole | null> {
  "use cache: private";
  cacheLife("minutes");
  return getAdminRole();
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}
