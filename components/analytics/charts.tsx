"use client";

import { useState } from "react";

// Categorical slots 1–2 of the validated reference palette (light surface).
const SERIES = { returning: "#2a78d6", new: "#eb6834" } as const;
const SINGLE = "#2a78d6";

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(value));
  const n = value / p;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function Gridlines({ max }: { max: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {[1, 0.5, 0].map((f) => (
        <div key={f} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${f * 100}%` }}>
          <span className="absolute -top-2 right-full mr-2 font-mono text-[10px] text-slate-400">{Math.round(max * f)}</span>
        </div>
      ))}
    </div>
  );
}

function Tooltip({ children, align }: { children: React.ReactNode; align: "left" | "center" | "right" }) {
  const pos = align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <div role="tooltip" className={`pointer-events-none absolute bottom-full z-10 mb-2 min-w-36 whitespace-nowrap rounded-md bg-slate-900 px-3 py-2 text-xs text-white shadow-lg ${pos}`}>
      {children}
    </div>
  );
}

export type TrendPoint = { label: string; newVisitors: number; returningVisitors: number; visits: number };

/** Unique visitors per bucket, split into new (orange) and returning (blue). */
export function VisitorTrend({ data }: { data: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.map((d) => d.newVisitors + d.returningVisitors)));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  if (data.length === 0) return <p className="py-10 text-center text-sm text-subtle">No visits in this range yet.</p>;

  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES.returning }} aria-hidden /> Returning visitors
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES.new }} aria-hidden /> New visitors
        </li>
      </ul>
      <div className="relative ml-7 h-48">
        <Gridlines max={max} />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => {
            const total = d.newVisitors + d.returningVisitors;
            const align = i < data.length * 0.2 ? "left" : i > data.length * 0.8 ? "right" : "center";
            return (
              <div
                key={d.label + i}
                className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${d.label}: ${total} visitors (${d.newVisitors} new, ${d.returningVisitors} returning), ${d.visits} visits`}
              >
                {hover === i && (
                  <Tooltip align={align}>
                    <p className="font-semibold">{d.label}</p>
                    <p className="mt-1 flex justify-between gap-4"><span>Returning</span><span className="font-mono">{d.returningVisitors}</span></p>
                    <p className="flex justify-between gap-4"><span>New</span><span className="font-mono">{d.newVisitors}</span></p>
                    <p className="mt-1 flex justify-between gap-4 border-t border-white/20 pt-1 text-white/80"><span>Visits</span><span className="font-mono">{d.visits}</span></p>
                  </Tooltip>
                )}
                {hover === i && <div className="absolute inset-0 rounded-sm bg-slate-900/5" aria-hidden />}
                {d.newVisitors > 0 && (
                  <div
                    className={`w-full ${d.returningVisitors > 0 ? "mb-[2px]" : ""} rounded-t-[4px]`}
                    style={{ height: `${(d.newVisitors / max) * 100}%`, background: SERIES.new }}
                  />
                )}
                {d.returningVisitors > 0 && (
                  <div
                    className={`w-full ${d.newVisitors > 0 ? "" : "rounded-t-[4px]"}`}
                    style={{ height: `${(d.returningVisitors / max) * 100}%`, background: SERIES.returning }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-7 mt-2 flex gap-[2px]" aria-hidden>
        {data.map((d, i) => (
          <span key={d.label + i} className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-400">
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Single-series vertical bars (e.g. visits by hour of day). */
export function SimpleBars({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div>
      <div className="relative ml-7 h-40">
        <Gridlines max={max} />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <div
              key={d.label}
              className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${d.label}: ${d.value} ${unit}`}
            >
              {hover === i && (
                <Tooltip align={i < data.length * 0.2 ? "left" : i > data.length * 0.8 ? "right" : "center"}>
                  <span className="font-semibold">{d.label}</span> · <span className="font-mono">{d.value}</span> {unit}
                </Tooltip>
              )}
              {d.value > 0 && <div className="w-full rounded-t-[4px]" style={{ height: `${(d.value / max) * 100}%`, background: SINGLE, opacity: hover === null || hover === i ? 1 : 0.55 }} />}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-7 mt-2 flex gap-[2px]" aria-hidden>
        {data.map((d, i) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-400">
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar list with values labelled directly (device, browser, OS breakdowns). */
export function BarList({ items, valueLabel }: { items: { label: string; value: number; sub?: string }[]; valueLabel: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="py-4 text-sm text-subtle">No data in this range.</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">{item.label}</span>
            <span className="shrink-0 font-mono text-xs text-slate-600">
              {item.value} {valueLabel}
              {item.sub && <span className="text-slate-400"> · {item.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100" aria-hidden>
            <div className="h-2 rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: SINGLE }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
