"use client";

import { useCallback, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refetchReport } from "@/app/actions";
import type { StudentData } from "./parse";

const STORAGE_KEY = "competency-report:v2";
const CHANGE_EVENT = "competency-report:change";

let cachedRaw: string | null | undefined;
let cachedValue: StudentData | null = null;

// Older versions may hold unsanitised data; drop them.
const LEGACY_KEYS = ["competency-report:v1"];
let legacyPurged = false;

function readStorage(): StudentData | null {
  let raw: string | null = null;
  try {
    if (!legacyPurged) {
      legacyPurged = true;
      for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
    }
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  // useSyncExternalStore needs a stable reference while the stored value is unchanged.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = raw ? (JSON.parse(raw) as StudentData) : null;
      cachedValue = parsed?.v === 2 ? parsed : null;
    } catch {
      cachedValue = null;
    }
  }
  return cachedValue;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function saveReport(data: StudentData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked; the page still works for this visit via the in-memory copy.
    cachedRaw = JSON.stringify(data);
    cachedValue = data;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearReport(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * The signed-in student's stored results.
 * undefined = not read yet (server render), null = nothing stored for this student.
 */
export function useStoredReport(email: string): StudentData | null | undefined {
  const data = useSyncExternalStore(subscribe, readStorage, () => undefined);
  if (data === undefined) return undefined;
  return data && data.email === email ? data : null;
}

/** Calls the API again for the signed-in student and replaces the stored copy. */
export function useRefetch() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await refetchReport();
      if (result.signedOut) {
        clearReport();
        router.replace("/login");
      } else if (result.data) {
        saveReport(result.data);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }, [router]);

  return { refetch, pending, error };
}
