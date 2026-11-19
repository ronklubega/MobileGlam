"use client";
import { useState } from "react";

export interface DayPoint { day: string; label: string; deposits: number; count: number }

const compact = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n));
const ugx = (n: number) => `UGX ${n.toLocaleString("en-US")}`;

/** Single-series daily deposits. One series: the page title names it, so no legend; the table below is the table view. */
export function RevenueChart({ days }: { days: DayPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.deposits));
  // Round the axis top to 1/2/5 × 10^n so ticks are clean numbers.
  const mag = 10 ** Math.floor(Math.log10(max));
  const top = [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= max) ?? max;
  const ticks = [top, top / 2, 0];
  const point = active !== null ? days[active] : undefined;
  const last = days.length - 1;

  return (
    <figure className="rounded-xl border border-line bg-surface p-4" aria-label="Daily deposits received">
      <div className="flex gap-3">
        <div className="flex h-48 flex-col justify-between pb-px text-right text-xs text-muted" aria-hidden>
          {ticks.map((t) => <span key={t}>{compact(t)}</span>)}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
            {ticks.map((t) => <div key={t} className="border-t border-line" />)}
          </div>
          <div className="relative flex h-48 items-end" onMouseLeave={() => setActive(null)}>
            {days.map((d, i) => (
              <div
                key={d.day}
                className="flex h-full flex-1 items-end justify-center px-px"
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: ${ugx(d.deposits)}, ${d.count} bookings`}
                onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
              >
                <div
                  className="w-full max-w-[24px] rounded-t-[4px]"
                  style={{ height: `${(d.deposits / top) * 100}%`, minHeight: d.deposits > 0 ? 2 : 0, background: "var(--series-1)", opacity: active === null || active === i ? 1 : 0.55 }}
                />
              </div>
            ))}
            {point ? (
              <div
                className="pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow"
                style={{ left: `${((active! + 0.5) / days.length) * 100}%`, transform: `translate(${active! > days.length * 0.7 ? "-100%" : active! < days.length * 0.3 ? "0%" : "-50%"}, -100%)` }}
              >
                <p className="font-semibold">{point.label}</p>
                <p>{ugx(point.deposits)}</p>
                <p className="text-muted">{point.count} booking{point.count === 1 ? "" : "s"}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted" aria-hidden>
            <span>{days[0]?.label}</span>
            {days.length > 2 ? <span>{days[Math.floor(last / 2)]?.label}</span> : null}
            <span>{days[last]?.label}</span>
          </div>
        </div>
      </div>
    </figure>
  );
}
