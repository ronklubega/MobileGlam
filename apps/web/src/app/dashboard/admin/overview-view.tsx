import Link from "next/link";
import type { ReactNode } from "react";
import { addDays, dateLabel, formatDateTime, formatUGX } from "@glamdesk/shared";
import { RankedBars, SegmentedBar, Sparkline, StackedColumns, TrendLine } from "@/components/charts";
import { pct, ugx, ugxCompact as compactUgx } from "@/lib/chart-format";
import { Card, Empty, PageHeader } from "@/components/ui";

export interface Stats {
  active_salons: number; pending_salons: number; suspended_salons: number; users: number;
  bookings_30d: number; deposits_30d: number; commission_30d: number; refunds_due: number;
}
interface Day { day: string; deposits: number; commission: number; bookings: number; new_users: number; new_businesses: number }
interface Totals { deposits: number; commission: number; bookings: number; clients: number; new_users: number; new_businesses: number }
export interface Analytics {
  from: string; to: string; days: number; series: Day[];
  totals: Totals & { returning: number; paying_businesses: number }; previous: Totals;
  users_before: number; businesses_before: number;
  business_mix: { type: "salon" | "barbershop" | "clinic"; active: number; pending: number; suspended: number }[];
  top_businesses: { id: string; name: string; type: string; area: string | null; deposits: number; bookings: number }[];
  by_area: { area: string; deposits: number; bookings: number }[];
  by_provider: { provider: "mtn_momo" | "airtel_money"; deposits: number; count: number }[];
  booking_outcomes: { status: string; count: number }[];
}
export interface Entry { id: string; actor_email: string | null; action: string; target_type: string | null; details: Record<string, unknown>; created_at: string }

export const RANGES = [{ label: "7 days", n: 7 }, { label: "30 days", n: 30 }, { label: "90 days", n: 90 }, { label: "12 months", n: 365 }];
const ACTION_LABEL: Record<string, string> = {
  "tenant.approve": "Approved business", "tenant.suspend": "Suspended business", "tenant.reinstate": "Reinstated business",
  "payment.refund": "Recorded refund", "admin.create": "Created admin", "admin.role_change": "Changed admin role", "admin.remove": "Removed admin",
};
const TYPE_LABEL = { salon: "Salons", barbershop: "Barbershops", clinic: "Hair clinics" } as const;
const TYPE_ONE = { salon: "Salon", barbershop: "Barbershop", clinic: "Hair clinic" } as Record<string, string>;
const OUTCOME = [
  { status: "completed", label: "Completed" }, { status: "confirmed", label: "Confirmed, upcoming" }, { status: "pending_payment", label: "Awaiting payment" },
  { status: "cancelled", label: "Cancelled" }, { status: "no_show", label: "No-show" }, { status: "expired", label: "Payment not completed" },
];

const short = (ymd: string) => dateLabel(ymd).split(" ").slice(1).join(" "); // "19 Nov"
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Daily rows → daily, weekly or monthly buckets so a chart never has more than ~60 columns. */
function bucket(series: Day[], days: number) {
  const keyOf = (d: string) => {
    if (days <= 31) return d;
    if (days <= 120) return addDays(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7)); // Monday of the week
    return d.slice(0, 7);
  };
  const labelOf = (k: string) => (days <= 31 ? short(k) : days <= 120 ? `Week of ${short(k)}` : `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`);
  const map = new Map<string, Day & { label: string }>();
  for (const d of series) {
    const k = keyOf(d.day);
    const b = map.get(k) ?? { day: k, label: labelOf(k), deposits: 0, commission: 0, bookings: 0, new_users: 0, new_businesses: 0 };
    b.deposits += Number(d.deposits); b.commission += Number(d.commission); b.bookings += Number(d.bookings);
    b.new_users += Number(d.new_users); b.new_businesses += Number(d.new_businesses);
    map.set(k, b);
  }
  return [...map.values()];
}

export function OverviewView({ s, a, entries, n }: { s: Stats; a: Analytics; entries: Entry[]; n: number }) {
  const t = a.totals, prev = a.previous;
  const buckets = bucket(a.series, a.days);
  const daily = a.series.map((d) => ({ ...d, deposits: Number(d.deposits), commission: Number(d.commission) }));
  const takeRate = t.deposits > 0 ? (t.commission / t.deposits) * 100 : 0;
  const avgDeposit = t.bookings > 0 ? t.deposits / t.bookings : 0;

  // Running totals across the window, starting from everything that existed before it.
  let users = Number(a.users_before), businesses = Number(a.businesses_before);
  const growth = buckets.map((b) => ({ label: b.label, users: (users += b.new_users), businesses: (businesses += b.new_businesses) }));

  const mix = (["salon", "barbershop", "clinic"] as const).map((type) => a.business_mix.find((m) => m.type === type) ?? { type, active: 0, pending: 0, suspended: 0 });
  const provider = (p: string) => a.by_provider.find((x) => x.provider === p);
  const outcomes = OUTCOME.map((o) => ({ ...o, count: Number(a.booking_outcomes.find((x) => x.status === o.status)?.count ?? 0) })).filter((o) => o.count > 0);
  const outcomeTotal = outcomes.reduce((x, o) => x + o.count, 0);
  const vs = `vs previous ${a.days === 365 ? "12 months" : `${a.days} days`}`;

  return (
    <>
      <PageHeader title="Platform overview">
        <nav aria-label="Time range" className="flex rounded-xl border border-line bg-surface p-1 text-sm">
          {RANGES.map((r) => (
            <Link key={r.n} href={`/dashboard/admin?days=${r.n}`} aria-current={r.n === n ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${r.n === n ? "bg-brand text-on-brand" : "text-muted hover:text-ink"}`}>{r.label}</Link>
          ))}
        </nav>
      </PageHeader>
      <p className="-mt-3 mb-5 text-sm text-muted">{dateLabel(a.from)} – {dateLabel(a.to)} · Kampala time · changes compared with the previous {a.days === 365 ? "12 months" : `${a.days} days`}</p>

      {s.pending_salons > 0 || s.refunds_due > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {s.pending_salons > 0 ? <Attention href="/dashboard/approvals">{s.pending_salons} business{s.pending_salons === 1 ? "" : "es"} awaiting approval</Attention> : null}
          {s.refunds_due > 0 ? <Attention href="/dashboard/refunds">{s.refunds_due} refund{s.refunds_due === 1 ? "" : "s"} due</Attention> : null}
        </div>
      ) : null}

      {/* ── headline KPIs ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Money processed" value={formatUGX(t.deposits)} cur={t.deposits} prev={prev.deposits} vs={vs} spark={daily.map((d) => d.deposits)} hint="Deposits clients paid by mobile money" />
        <Kpi label="GlamDesk revenue" value={formatUGX(t.commission)} cur={t.commission} prev={prev.commission} vs={vs} spark={daily.map((d) => d.commission)} hint={t.deposits ? `${takeRate.toFixed(1)}% take rate` : "Commission on deposits"} />
        <Kpi label="Paid bookings" value={t.bookings.toLocaleString("en-US")} cur={t.bookings} prev={prev.bookings} vs={vs} spark={daily.map((d) => Number(d.bookings))} hint={avgDeposit ? `${ugx(avgDeposit)} average deposit` : undefined} />
        <Kpi label="New users" value={t.new_users.toLocaleString("en-US")} cur={t.new_users} prev={prev.new_users} vs={vs} spark={daily.map((d) => Number(d.new_users))} hint={`${Number(s.users).toLocaleString("en-US")} registered in total`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini label="Active businesses" value={String(s.active_salons)} hint={`${t.paying_businesses} took payments this period`} />
        <Mini label="New businesses" value={String(t.new_businesses)} hint={delta(t.new_businesses, prev.new_businesses).text + " " + vs} />
        <Mini label="Paying clients" value={String(t.clients)} hint={t.clients ? `${pct(t.returning, t.clients)} came back for another booking` : "No paid bookings yet"} />
        <Mini label="Suspended" value={String(s.suspended_salons)} hint={s.suspended_salons ? "Not visible to clients" : "None"} />
      </div>

      {/* ── money over time ── */}
      <Section title="Money flowing through GlamDesk" subtitle={`Deposits per ${a.days <= 31 ? "day" : a.days <= 120 ? "week" : "month"}, split into what businesses keep and GlamDesk's commission`}>
        {t.deposits === 0 ? <Empty>No deposits in this period yet. Paid bookings will appear here.</Empty> : (
          <StackedColumns
            series={[{ name: "Kept by businesses", color: "var(--series-1)" }, { name: "GlamDesk commission", color: "var(--series-2)" }]}
            points={buckets.map((b) => ({ label: b.label, values: [b.deposits - b.commission, b.commission] }))}
            totalLabel="Deposits"
          />
        )}
      </Section>

      {/* ── growth ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Registered users" subtitle="Running total of client and business accounts" figure={<Figure value={growth.at(-1)?.users ?? 0} added={t.new_users} />}>
          <TrendLine points={growth.map((g) => ({ label: g.label, value: g.users }))} unit=" users" />
        </Section>
        <Section title="Businesses on GlamDesk" subtitle="Running total of salons, barbershops and clinics that signed up" figure={<Figure value={growth.at(-1)?.businesses ?? 0} added={t.new_businesses} />}>
          <TrendLine points={growth.map((g) => ({ label: g.label, value: g.businesses }))} unit=" businesses" />
        </Section>
      </div>

      {/* ── mix ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Business mix" subtitle="All businesses by category">
          <SegmentedBar parts={mix.map((m, i) => ({
            name: TYPE_LABEL[m.type], value: m.active + m.pending + m.suspended, color: `var(--series-${i + 1})`,
            hint: m.pending || m.suspended ? [m.pending && `${m.pending} pending`, m.suspended && `${m.suspended} suspended`].filter(Boolean).join(", ") : undefined,
          }))} />
        </Section>
        <Section title="Payment methods" subtitle="Share of deposits this period">
          {a.by_provider.length === 0 ? <Quiet>No payments in this period.</Quiet> : (
            <SegmentedBar format="ugxCompact" parts={[
              { name: "MTN MoMo", value: Number(provider("mtn_momo")?.deposits ?? 0), color: "var(--series-1)", hint: `${provider("mtn_momo")?.count ?? 0} payments` },
              { name: "Airtel Money", value: Number(provider("airtel_money")?.deposits ?? 0), color: "var(--series-2)", hint: `${provider("airtel_money")?.count ?? 0} payments` },
            ]} />
          )}
        </Section>
        <Section title="Booking outcomes" subtitle="Bookings created this period">
          {outcomeTotal === 0 ? <Quiet>No bookings created in this period.</Quiet> : (
            <RankedBars numbered={false} rows={outcomes.map((o) => ({ key: o.status, name: o.label, value: o.count, display: `${o.count} · ${pct(o.count, outcomeTotal)}` }))} />
          )}
        </Section>
      </div>

      {/* ── leaders ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Top businesses" subtitle="By deposits received this period" action={<Link href="/dashboard/admin/salons" className="text-sm font-semibold text-brand">All businesses →</Link>}>
          {a.top_businesses.length === 0 ? <Quiet>No business has received a deposit in this period.</Quiet> : (
            <RankedBars rows={a.top_businesses.map((b) => ({
              key: b.id, name: b.name, sub: [TYPE_ONE[b.type], b.area].filter(Boolean).join(" · "), value: Number(b.deposits),
              display: compactUgx(Number(b.deposits)),
            }))} />
          )}
        </Section>
        <Section title="Where the money comes from" subtitle="Deposits by area this period">
          {a.by_area.length === 0 ? <Quiet>No deposits in this period.</Quiet> : (
            <RankedBars color="var(--series-3)" rows={foldOther(a.by_area, 7).map((r) => ({ key: r.area, name: r.area, sub: `${r.bookings} booking${r.bookings === 1 ? "" : "s"}`, value: r.deposits, display: compactUgx(r.deposits) }))} />
          )}
        </Section>
      </div>

      {/* ── audit trail ── */}
      <h2 className="mb-3 mt-8 text-lg font-bold">Recent operator activity</h2>
      {entries.length === 0 ? <Empty>No operator activity recorded yet.</Empty> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">What</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line align-top last:border-0">
                  <td className="whitespace-nowrap p-3 text-muted">{formatDateTime(e.created_at)}</td>
                  <td className="p-3">{e.actor_email ?? "—"}</td>
                  <td className="p-3">
                    <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>
                    {typeof e.details.name === "string" ? <span> · {e.details.name}</span> : null}
                    {typeof e.details.email === "string" ? <span> · {e.details.email}</span> : null}
                    {typeof e.details.reason === "string" ? <span className="block text-xs text-muted">Reason: {e.details.reason}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

// ───────────────────────────────────────────── page pieces

function foldOther(rows: { area: string; deposits: number; bookings: number }[], keep: number) {
  const r = rows.map((x) => ({ ...x, deposits: Number(x.deposits), bookings: Number(x.bookings) }));
  if (r.length <= keep) return r;
  const rest = r.slice(keep - 1);
  return [...r.slice(0, keep - 1), { area: `${rest.length} other areas`, deposits: rest.reduce((s, x) => s + x.deposits, 0), bookings: rest.reduce((s, x) => s + x.bookings, 0) }];
}

function delta(cur: number, prev: number) {
  cur = Number(cur); prev = Number(prev);
  if (cur === prev) return { text: "No change", dir: 0 };
  if (prev === 0) return { text: "New", dir: 1 };
  const d = ((cur - prev) / prev) * 100;
  return { text: `${d > 0 ? "+" : ""}${Math.abs(d) >= 10 ? Math.round(d) : d.toFixed(1)}%`, dir: Math.sign(d) };
}

function Kpi({ label, value, cur, prev, vs, spark, hint }: { label: string; value: string; cur: number; prev: number; vs: string; spark: number[]; hint?: string }) {
  const d = delta(cur, prev);
  const tone = d.dir > 0 ? "bg-success-soft text-success" : d.dir < 0 ? "bg-danger-soft text-danger" : "bg-bg text-muted";
  return (
    <Card className="flex flex-col">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-[26px] font-bold leading-tight tracking-tight tabular-nums">{value}</p>
      <p className="mt-1.5 flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${tone}`}>
          <span aria-hidden>{d.dir > 0 ? "▲" : d.dir < 0 ? "▼" : "–"}</span>{d.text}
        </span>
        <span className="text-muted">{vs}</span>
      </p>
      <div className="mt-3"><Sparkline values={spark} /></div>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

const Mini = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Card className="py-3">
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
    {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
  </Card>
);

function Section({ title, subtitle, children, figure, action }: { title: string; subtitle?: string; children: ReactNode; figure?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="mt-4 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {figure ?? action}
      </div>
      {children}
    </Card>
  );
}

const Figure = ({ value, added }: { value: number; added: number }) => (
  <div className="text-right">
    <p className="text-2xl font-bold leading-none tabular-nums">{value.toLocaleString("en-US")}</p>
    <p className="mt-1 text-xs text-muted">{added > 0 ? `+${added} this period` : "No new sign-ups"}</p>
  </div>
);

const Attention = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="inline-flex items-center gap-2 rounded-full border border-warn/30 bg-warn-soft px-3 py-1.5 text-sm font-semibold text-warn hover:brightness-95">
    <span aria-hidden className="h-2 w-2 rounded-full bg-warn" />{children}<span aria-hidden>→</span>
  </Link>
);

const Quiet = ({ children }: { children: ReactNode }) => <p className="py-6 text-center text-sm text-muted">{children}</p>;
