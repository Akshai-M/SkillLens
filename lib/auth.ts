import { redirect } from "next/navigation";
import { readSession, type Session } from "./session";

/** Resolves the signed-in student or sends them to /login. Reads the cookie only — no API call. */
export async function requireStudent(): Promise<Session> {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
}
