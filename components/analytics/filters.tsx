"use client";

import { CalendarRange, ListFilter } from "lucide-react";
import Form from "next/form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

function Field({ label, htmlFor, className = "", children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={htmlFor} className="text-xs text-subtle">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Global filters: apply to the whole dashboard. Submitting updates the URL so views are shareable. */
export function AnalyticsFilterBar({ filters }: { filters: AnalyticsFilters }) {
  const [range, setRange] = useState<string>(filters.range);
  return (
    <Form action="/admin/analytics" className="flex flex-wrap items-end gap-x-3 gap-y-3 rounded-lg border border-line bg-white p-4">
      <div className="w-full">
        <p className="text-sm font-semibold">Global filters</p>
        <p className="text-xs text-subtle">Apply to the whole dashboard, including the student table.</p>
      </div>
      <Field label="Date range" htmlFor="f-range">
        <Select name="range" value={range} onValueChange={setRange}>
          <SelectTrigger id="f-range" className="w-44">
            <CalendarRange aria-hidden className="text-subtle" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {range === "custom" && (
        <>
          <Field label="From" htmlFor="f-from">
            <Input id="f-from" type="date" name="from" defaultValue={filters.from} required className="w-40" />
          </Field>
          <Field label="To" htmlFor="f-to">
            <Input id="f-to" type="date" name="to" defaultValue={filters.to} required className="w-40" />
          </Field>
        </>
      )}
      <input type="hidden" name="trend" value={filters.trend} />
      <Button type="submit" className="shrink-0">
        <ListFilter aria-hidden />
        Apply
      </Button>
    </Form>
  );
}
