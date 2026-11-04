"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { startTracker, trackPageview } from "@/lib/analytics/tracker";

/** Mounted on signed-in student pages only; records visits, sessions, page views and active time. */
export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    startTracker();
  }, []);

  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);

  return null;
}
