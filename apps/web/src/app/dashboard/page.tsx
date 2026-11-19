import Link from "next/link";
import { addDays, dateLabel, formatTime, formatUGX, kampalaDateOf, kampalaInstant } from "@glamdesk/shared";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { SetupChecklist } from "@/components/setup-checklist";
import { getContext } from "@/lib/dashboard";
import { getSetupSteps } from "@/lib/setup";
import { updateBookingStatus } from "./actions";

interface Row {
  id: string; starts_at: string; ends_at: string; status: "pending_payment" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";
  price_ugx: number; deposit_ugx: number; is_home_visit: boolean; address: string | null; notes: string | null; client_id: string;
  profiles: { full_name: string | null; phone: string | null; avatar_url: string | null } | null; services: { name: string } | null; staff: { display_name: string } | null;
}
const TONE = { confirmed: "success", pending_payment: "warn", completed: "neutral", cancelled: "danger", no_show: "danger", expired: "danger" } as const;
const LABEL = { confirmed: "Confirmed", pending_payment: "Awaiting payment", completed: "Completed", cancelled: "Cancelled", no_show: "No-show", expired: "Expired" } as const;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await getContext();
  if (!ctx.tenant) return null;
  const sp = await searchParams;
  const today = kampalaDateOf(new Date());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? (sp.date as string) : today;
  const from = kampalaInstant(date, "00:00");
  const to = new Date(from.getTime() + 86_400_000);

  const { data, error } = await ctx.supabase
    .from("bookings")
    .select("id,starts_at,ends_at,status,price_ugx,deposit_ugx,is_home_visit,address,notes,client_id,profiles(full_name,phone,avatar_url),services(name),staff(display_name)")
    .eq("tenant_id", ctx.tenant.id).gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString())
    .neq("status", "expired").order("starts_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const steps = ctx.role === "staff" ? [] : await getSetupSteps(ctx.supabase, ctx.tenant.id, { includePayout: ctx.role === "owner" });

  const active = rows.filter((r) => r.status === "confirmed" || r.status === "completed" || r.status === "no_show");
  const deposits = active.reduce((n, r) => n + Number(r.deposit_ugx), 0);
  const balance = rows.filter((r) => r.status === "confirmed" || r.status === "completed").reduce((n, r) => n + Number(r.price_ugx) - Number(r.deposit_ugx), 0);

  return (
    <>
      <SetupChecklist steps={steps} pending={!ctx.tenant.is_active} />
      <PageHeader title={date === today ? "Today" : dateLabel(date)}>
        <div className="flex items-center gap-2 text-sm">
          <Link className="rounded-lg border border-line px-3 py-1.5" href={`/dashboard?date=${addDays(date, -1)}`}>← Prev</Link>
          {date !== today ? <Link className="rounded-lg border border-line px-3 py-1.5" href="/dashboard">Today</Link> : null}
          <Link className="rounded-lg border border-line px-3 py-1.5" href={`/dashboard?date=${addDays(date, 1)}`}>Next →</Link>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Appointments" value={String(rows.filter((r) => r.status === "confirmed" || r.status === "completed").length)} hint={`${dateLabel(date)}`} />
        <Stat label="Deposits received" value={formatUGX(deposits)} />
        <Stat label="Balance to collect in salon" value={formatUGX(balance)} hint="Price minus deposit, for confirmed visits" />
      </div>

      {rows.length === 0 ? <Empty>No bookings on this day.</Empty> : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const started = new Date(r.starts_at).getTime() <= Date.now() + 30 * 60_000;
            return (
              <li key={r.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {r.profiles?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.profiles.avatar_url} alt={`${r.profiles.full_name ?? "Client"} photo`} width={48} height={48} loading="lazy" className="h-12 w-12 rounded-full object-cover" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold">{formatTime(r.starts_at)} – {formatTime(r.ends_at)}</p>
                      <p className="font-medium">{r.services?.name} <span className="text-muted">with {r.staff?.display_name}</span></p>
                      <p className="mt-1 text-sm">
                        <Link className="font-medium text-brand" href={`/dashboard/clients/${r.client_id}`}>{r.profiles?.full_name || "Client"}</Link>
                        {r.profiles?.phone ? <> · <a className="text-muted" href={`tel:${r.profiles.phone}`}>{r.profiles.phone}</a></> : null}
                      </p>
                      {r.is_home_visit ? <p className="mt-1 text-sm text-muted">🏠 Home visit: {r.address}</p> : null}
                      {r.notes ? <p className="mt-1 text-sm text-muted">Note: {r.notes}</p> : null}
                      <p className="mt-1 text-xs text-muted">Deposit {formatUGX(Number(r.deposit_ugx))} of {formatUGX(Number(r.price_ugx))}</p>
                    </div>
                    <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                  </div>
                  {r.status === "confirmed" ? (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                      {started ? (
                        <>
                          <ActionForm action={updateBookingStatus.bind(null, r.id, "completed")}><SubmitButton>Mark completed</SubmitButton></ActionForm>
                          <ActionForm action={updateBookingStatus.bind(null, r.id, "no_show")}><SubmitButton variant="ghost">No-show</SubmitButton></ActionForm>
                        </>
                      ) : null}
                      <ActionForm action={updateBookingStatus.bind(null, r.id, "cancelled")}><SubmitButton variant="danger">Cancel</SubmitButton></ActionForm>
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
