"use server";

import { redirect } from "next/navigation";
import type { StudentData } from "@/lib/report/parse";
import { checkAdminPassword, createAdminSession, destroyAdminSession, isAdmin } from "@/lib/session";
import { fetchAdminData, hasInterviews } from "@/lib/sheets";

export type AdminLoginState = { error?: string };

export async function adminLogin(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const password = String(formData.get("password") ?? "");
  if (!process.env.ADMIN_PASSWORD) return { error: "Admin access isn't configured. Set ADMIN_PASSWORD in .env." };
  if (!checkAdminPassword(password)) return { error: "Incorrect password." };
  await createAdminSession();
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

export type AdminLookupResult = { data?: StudentData; error?: string; signedOut?: boolean };

/** Full report data (including internal notes) for one student. Admin session required. */
export async function adminLookup(email: string): Promise<AdminLookupResult> {
  if (!(await isAdmin())) return { signedOut: true };
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { error: "Enter a valid email address." };
  try {
    const data = await fetchAdminData(clean);
    return hasInterviews(data) ? { data } : { error: `No interviews found for ${clean}.` };
  } catch {
    return { error: "Couldn't reach the results service. Try again in a minute." };
  }
}
