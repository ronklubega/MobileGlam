import Link from "next/link";
import { addDays, commissionAmount, dateLabel, formatUGX, kampalaDateOf } from "@mobileglam/shared";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { requireManager } from "@/lib/dashboard";
import { RevenueChart, type DayPoint } from "./revenue-chart";

interface Rev { day: string; deposits_ugx: number; commission_ugx: number; bookings_count: number }
const RANGES = [{ label: "7 days", n: 7 }, { label: "30 days", n: 30 }, { label: "90 days", n: 90 }];

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const ctx = await requireManager();
  const sp = await searchParams;
  const n = RANGES.some((r) => String(r.n) === sp.days) ? Number(sp.days) : 30;
  const to = kampalaDateOf(new Date());
  const from = addDays(to, -(n - 1));

  const { data, error } = await ctx.supabase.rpc("tenant_daily_revenue", { p_tenant: ctx.tenant.id, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  const byDay = new Map(((data ?? []) as Rev[]).map((r) => [r.day, r]));

  const days: DayPoint[] = [];
  for (let i = 0; i < n; i++) {
    const day = addDays(from, i);
    const r = byDay.get(day);
    days.push({ day, label: dateLabel(day), deposits: Number(r?.deposits_ugx ?? 0), count: Number(r?.bookings_count ?? 0) });
  }
  const deposits = days.reduce((s, d) => s + d.deposits, 0);
  const commission = Array.from(byDay.values()).reduce((s, r) => s + Number(r.commission_ugx), 0);
  const bookings = days.reduce((s, d) => s + d.count, 0);
  const rate = ctx.tenant.commission_bps / 100;

  return (
    <>
      <PageHeader title="Revenue">
        <div className="flex gap-2 text-sm">
          {RANGES.map((r) => (
            <Link key={r.n} href={`/dashboard/revenue?days=${r.n}`} className={`rounded-lg border px-3 py-1.5 ${r.n === n ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>{r.label}</Link>
          ))}
        </div>
      </PageHeader>

      <p className="text-sm text-muted">Deposits received, last {n} days</p>
      <p className="mb-5 text-5xl font-bold">{formatUGX(deposits)}</p>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Platform commission" value={formatUGX(commission)} hint={`${rate}% of deposits (rate in effect when each booking was made)`} />
        <Stat label="Net payable to your salon" value={formatUGX(deposits - commission)} hint="Deposits minus commission" />
        <Stat label="Paid bookings" value={String(bookings)} />
      </div>

      {deposits === 0 ? <Empty>No deposits received in this period yet.</Empty> : (
        <>
          <RevenueChart days={days} />
          <h2 className="mb-2 mt-8 text-lg font-bold">By day</h2>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr><th className="p-3">Date</th><th className="p-3 text-right">Bookings</th><th className="p-3 text-right">Deposits</th><th className="p-3 text-right">Commission</th><th className="p-3 text-right">Net</th></tr>
              </thead>
              <tbody>
                {days.filter((d) => d.count > 0).reverse().map((d) => {
                  const c = Number(byDay.get(d.day)?.commission_ugx ?? commissionAmount(d.deposits, ctx.tenant.commission_bps));
                  return (
                    <tr key={d.day} className="border-b border-line last:border-0">
                      <td className="p-3">{d.label}</td>
                      <td className="p-3 text-right tabular-nums">{d.count}</td>
                      <td className="p-3 text-right tabular-nums">{formatUGX(d.deposits)}</td>
                      <td className="p-3 text-right tabular-nums">{formatUGX(c)}</td>
                      <td className="p-3 text-right tabular-nums">{formatUGX(d.deposits - c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
