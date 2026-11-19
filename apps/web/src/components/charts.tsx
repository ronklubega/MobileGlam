"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { FORMATS, compact, pct, type Format } from "@/lib/chart-format";

/** Rounds an axis top up to 1 / 2 / 2.5 / 5 × 10^n so the ticks are clean numbers. */
function niceTop(max: number) {
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= max) ?? max;
}

function Tip({ at, children }: { at: number; children: ReactNode }) {
  const shift = at > 0.7 ? "-100%" : at < 0.3 ? "0%" : "-50%";
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute -top-2 z-20 whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left: `${at * 100}%`, transform: `translate(${shift}, -100%)` }}
    >
      {children}
    </div>
  );
}

const Swatch = ({ color, line }: { color: string; line?: boolean }) => (
  <span aria-hidden className={line ? "inline-block h-0.5 w-3 rounded-full" : "inline-block h-2.5 w-2.5 rounded-[3px]"} style={{ background: color }} />
);

export function Legend({ items }: { items: { name: string; color: string; line?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => <li key={i.name} className="flex items-center gap-1.5"><Swatch color={i.color} line={i.line} />{i.name}</li>)}
    </ul>
  );
}

function YAxis({ top, format }: { top: number; format: (n: number) => string }) {
  return (
    <div className="flex h-full flex-col justify-between text-right text-[11px] tabular-nums text-muted" aria-hidden>
      {[top, top / 2, 0].map((t) => <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">{format(t)}</span>)}
    </div>
  );
}

const Grid = () => (
  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
    {[0, 1, 2].map((i) => <div key={i} className="border-t" style={{ borderColor: "var(--grid)" }} />)}
  </div>
);

function XLabels({ labels }: { labels: string[] }) {
  const last = labels.length - 1;
  return (
    <div className="mt-1.5 flex justify-between text-[11px] text-muted" aria-hidden>
      <span>{labels[0]}</span>
      {labels.length > 4 ? <span>{labels[Math.floor(last / 2)]}</span> : null}
      {last > 0 ? <span>{labels[last]}</span> : null}
    </div>
  );
}

// ───────────────────────────────────────────── stacked columns

export interface StackSeries { name: string; color: string }
export interface StackPoint { label: string; values: number[] }

/** Columns split into parts of one whole (e.g. deposits = commission + net to businesses). */
export function StackedColumns({ points, series, format: fmt = "ugx", height = 220, totalLabel = "Total" }: {
  points: StackPoint[]; series: StackSeries[]; format?: Format; height?: number; totalLabel?: string;
}) {
  const format = FORMATS[fmt];
  const [active, setActive] = useState<number | null>(null);
  const totals = points.map((p) => p.values.reduce((a, b) => a + b, 0));
  const top = niceTop(Math.max(0, ...totals));
  const p = active !== null ? points[active] : undefined;

  return (
    <div>
      <Legend items={series} />
      <div className="mt-3 flex gap-2.5">
        <div style={{ height }}><YAxis top={top} format={compact} /></div>
        <div className="relative flex-1">
          <Grid />
          <div className="relative flex items-end" style={{ height }} onMouseLeave={() => setActive(null)}>
            {points.map((pt, i) => (
              <div
                key={pt.label + i} tabIndex={0} role="img"
                aria-label={`${pt.label}: ${series.map((s, k) => `${s.name} ${format(pt.values[k] ?? 0)}`).join(", ")}`}
                className="flex h-full flex-1 items-end justify-center px-[1px] outline-none"
                onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
              >
                <div className="flex w-full max-w-[24px] flex-col-reverse gap-[2px]" style={{ height: `${(totals[i]! / top) * 100}%`, opacity: active === null || active === i ? 1 : 0.45 }}>
                  {pt.values.map((v, k) => {
                    const isTop = pt.values.slice(k + 1).every((x) => !x);
                    return v > 0 ? (
                      <div key={k} className={isTop ? "rounded-t-[4px]" : ""} style={{ flexGrow: v, flexBasis: 0, minHeight: 2, background: series[k]!.color }} />
                    ) : null;
                  })}
                </div>
              </div>
            ))}
            {p ? (
              <Tip at={(active! + 0.5) / points.length}>
                <p className="mb-1 font-semibold">{p.label}</p>
                {series.map((s, k) => (
                  <p key={s.name} className="flex items-center gap-1.5"><Swatch color={s.color} />{s.name}<span className="ml-auto pl-3 tabular-nums font-medium">{format(p.values[k] ?? 0)}</span></p>
                ))}
                <p className="mt-1 flex border-t border-line pt-1 font-semibold">{totalLabel}<span className="ml-auto pl-3 tabular-nums">{format(totals[active!]!)}</span></p>
              </Tip>
            ) : null}
          </div>
          <XLabels labels={points.map((x) => x.label)} />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────── line (single series)

/** One measure over time: 2px line, faint area wash, crosshair + tooltip, value labelled at the end. */
export function TrendLine({ points, color = "var(--series-1)", format: fmt = "number", height = 160, unit = "" }: {
  points: { label: string; value: number }[]; color?: string; format?: Format; height?: number; unit?: string;
}) {
  const format = FORMATS[fmt];
  const [active, setActive] = useState<number | null>(null);
  const top = niceTop(Math.max(0, ...points.map((p) => p.value)));
  const n = points.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / top) * 100;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(n - 1)},100 L${x(0)},100 Z`;
  const i = active ?? n - 1;
  const p = points[i];

  return (
    <div className="flex gap-2.5">
      <div style={{ height }}><YAxis top={top} format={compact} /></div>
      <div className="relative flex-1">
        <Grid />
        <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <path d={area} fill={color} opacity={0.1} />
            <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {active !== null ? <line x1={x(i)} x2={x(i)} y1={0} y2={100} stroke="var(--muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.5} /> : null}
          </svg>
          {p ? (
            <span
              aria-hidden className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2"
              style={{ left: `${x(i)}%`, bottom: `${100 - y(p.value)}%`, background: color, ["--tw-ring-color" as string]: "var(--surface)" }}
            />
          ) : null}
          <div className="absolute inset-0 flex">
            {points.map((pt, k) => (
              <div key={pt.label + k} className="h-full flex-1 outline-none" tabIndex={0} role="img" aria-label={`${pt.label}: ${format(pt.value)}${unit}`}
                onMouseEnter={() => setActive(k)} onFocus={() => setActive(k)} onBlur={() => setActive(null)} />
            ))}
          </div>
          {active !== null && p ? (
            <Tip at={x(i) / 100}><p className="font-semibold">{p.label}</p><p className="tabular-nums">{format(p.value)}{unit}</p></Tip>
          ) : null}
        </div>
        <XLabels labels={points.map((pt) => pt.label)} />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────── sparkline

/** Tiny trend for a stat tile: muted line, the latest point in the accent. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const n = values.length;
  const pts = values.map((v, i) => `${(i / (n - 1)) * 100},${28 - (v / max) * 24 - 2}`);
  const last = values[n - 1]!;
  return (
    <div className="relative h-7 w-full" aria-hidden>
      <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <polyline points={pts.join(" ")} fill="none" stroke="var(--muted)" strokeOpacity={0.55} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full" style={{ right: -4, bottom: `${((last / max) * 24 + 2) / 28 * 100}%`, background: "var(--series-1)" }} />
    </div>
  );
}

// ───────────────────────────────────────────── segmented bar

export interface Part { name: string; value: number; color: string; hint?: string }

/** One whole split into parts, with a legend that carries every value (so colour is never the only key). */
export function SegmentedBar({ parts, format: fmt = "number" }: { parts: Part[]; format?: Format }) {
  const format = FORMATS[fmt];
  const [active, setActive] = useState<number | null>(null);
  const shown = parts.filter((p) => p.value > 0);
  const total = shown.reduce((s, p) => s + p.value, 0);
  let acc = 0;
  const mids = shown.map((p) => { const m = (acc + p.value / 2) / (total || 1); acc += p.value; return m; });

  return (
    <div>
      <div className="relative">
        <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-full" onMouseLeave={() => setActive(null)}>
          {total === 0 ? <div className="h-full w-full" style={{ background: "var(--grid)" }} /> : shown.map((p, i) => (
            <div key={p.name} tabIndex={0} role="img" aria-label={`${p.name}: ${format(p.value)} (${pct(p.value, total)})`}
              className="h-full outline-none transition-opacity" style={{ flexGrow: p.value, flexBasis: 0, background: p.color, opacity: active === null || active === i ? 1 : 0.45 }}
              onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
          ))}
        </div>
        {active !== null && shown[active] ? (
          <Tip at={mids[active]!}>
            <p className="font-semibold">{shown[active].name}</p>
            <p className="tabular-nums">{format(shown[active].value)} · {pct(shown[active].value, total)}</p>
          </Tip>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-2">
            <Swatch color={p.color} />
            <span>{p.name}</span>
            {p.hint ? <span className="text-xs text-muted">{p.hint}</span> : null}
            <span className="ml-auto tabular-nums font-semibold">{format(p.value)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted">{pct(p.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────────────────────────── ranked bars

export interface RankRow { key: string; name: string; sub?: string; value: number; display: string; href?: string }

/** Leaderboard: one hue, bars share a scale, value at each bar's tip. */
export function RankedBars({ rows, color = "var(--series-1)", numbered = true }: { rows: RankRow[]; color?: string; numbered?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => {
        const body = (
          <>
            <div className="flex items-baseline gap-2 text-sm">
              {numbered ? <span className="w-4 shrink-0 text-xs tabular-nums text-muted">{i + 1}</span> : null}
              <span className="truncate font-medium">{r.name}</span>
              {r.sub ? <span className="hidden truncate text-xs text-muted sm:inline">{r.sub}</span> : null}
              <span className="ml-auto shrink-0 pl-2 text-xs font-semibold tabular-nums">{r.display}</span>
            </div>
            <div className={`mt-1.5 h-2 rounded-r-[4px] ${numbered ? "ml-6" : ""}`} style={{ background: "var(--grid)" }}>
              <div className="h-full rounded-r-[4px] transition-[filter] group-hover:brightness-110" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: color }} />
            </div>
          </>
        );
        return (
          <li key={r.key} title={`${r.name}: ${r.display}`}>
            {r.href ? <Link href={r.href} className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand">{body}</Link> : <div className="group">{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}
