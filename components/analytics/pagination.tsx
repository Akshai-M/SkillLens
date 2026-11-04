"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 15;

/** Current page for a list of `count` rows; clamps when the list shrinks (e.g. after filtering). */
export function usePage(count: number, size = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(count / size));
  const current = Math.min(page, pages);
  return { page: current, pages, size, setPage, start: (current - 1) * size, end: Math.min(current * size, count) };
}

export function Pagination({ count, pager }: { count: number; pager: ReturnType<typeof usePage> }) {
  const { page, pages, size, setPage, start, end } = pager;
  if (count <= size) return null;
  return (
    <nav aria-label="Table pages" className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-subtle">
      <p>
        Showing <span className="font-medium text-ink">{start + 1}–{end}</span> of {count}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
          <ChevronLeft /> Previous
        </Button>
        <span className="tabular-nums">
          Page {page} of {pages}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pages}>
          Next <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

/** Simple table with 15 rows per page, for the server-rendered analytics sections. */
export function PaginatedTable({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  const pager = usePage(rows.length);
  if (rows.length === 0) return <p className="text-sm text-subtle">{empty}</p>;
  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-subtle">
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.slice(pager.start, pager.end).map((r, i) => (
              <tr key={pager.start + i} className="hover:bg-slate-50">
                {r.map((c, j) => (
                  <td key={j} className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination count={rows.length} pager={pager} />
    </div>
  );
}
