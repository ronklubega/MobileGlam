import Link from "next/link";
import { formatDay, formatUGX } from "@mobileglam/shared";
import { ActionForm, SubmitButton, inputClass } from "@/components/forms";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { supabaseAdmin } from "@/lib/auth";
import { getContext } from "@/lib/dashboard";
import { atLeast, requirePlatformRole } from "@/lib/platform";
import { approveTenant, reinstateTenant, suspendTenant } from "../actions";

interface Salon {
  id: string; name: string; type: string; area: string | null; is_active: boolean; approved_at: string | null; suspended_at: string | null;
  suspension_reason: string | null; created_at: string; owner_name: string | null; owner_email: string | null;
  services_count: number; staff_count: number; bookings_30d: number; deposits_30d: number; upcoming_confirmed: number;
}
type Status = "active" | "pending" | "suspended";
const statusOf = (s: Salon): Status => (s.suspended_at ? "suspended" : s.is_active ? "active" : "pending");
const TONE = { active: "success", pending: "warn", suspended: "danger" } as const;
const TABS: { key: Status | "all"; label: string }[] = [{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "pending", label: "Pending" }, { key: "suspended", label: "Suspended" }];

export default async function SalonsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const ctx = await requirePlatformRole(await getContext(), "support");
  const canManage = atLeast(ctx.platformRole, "admin");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const filter = TABS.some((t) => t.key === sp.status) ? (sp.status as Status | "all") : "all";

  const { data, error } = await supabaseAdmin().rpc("admin_salon_overview");
  if (error) throw new Error(error.message);
  const all = (data ?? []) as Salon[];
  const counts = { all: all.length, active: 0, pending: 0, suspended: 0 };
  for (const s of all) counts[statusOf(s)]++;
  const rows = all.filter((s) => (filter === "all" || statusOf(s) === filter) &&
    (!q || [s.name, s.area, s.owner_email, s.owner_name].some((v) => v?.toLowerCase().includes(q))));

  return (
    <>
      <PageHeader title="Businesses" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {TABS.map((t) => (
            <Link key={t.key} href={`/dashboard/admin/salons?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-lg border px-3 py-1.5 ${filter === t.key ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>
              {t.label} <span className="text-muted">{counts[t.key]}</span>
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="status" value={filter} />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name, area or owner" className={`${inputClass} w-64`} aria-label="Search businesses" />
          <button className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">Search</button>
        </form>
      </div>

      {rows.length === 0 ? <Empty>No businesses match.</Empty> : (
        <ul className="space-y-3">
          {rows.map((s) => {
            const st = statusOf(s);
            return (
              <li key={s.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-bold">{s.name} <Badge tone={TONE[st]}>{st}</Badge> <Badge tone="neutral">{s.type}</Badge></p>
                      <p className="text-sm text-muted">{s.area ?? "—"} · registered {formatDay(s.created_at)}</p>
                      <p className="mt-1 text-sm">Owner: {s.owner_name ?? "—"} <span className="text-muted">{s.owner_email}</span></p>
                      <p className="mt-1 text-xs text-muted">
                        {s.services_count} services · {s.staff_count} staff · {s.bookings_30d} paid bookings & {formatUGX(Number(s.deposits_30d))} deposits (30 days) · {s.upcoming_confirmed} upcoming
                      </p>
                      {s.suspension_reason ? <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">Suspended: {s.suspension_reason}</p> : null}
                    </div>
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        {st === "pending" ? <ActionForm action={approveTenant.bind(null, s.id)}><SubmitButton>Approve</SubmitButton></ActionForm> : null}
                        {st === "suspended" ? <ActionForm action={reinstateTenant.bind(null, s.id)}><SubmitButton variant="ghost">Reinstate</SubmitButton></ActionForm> : null}
                      </div>
                    ) : null}
                  </div>
                  {canManage && st !== "suspended" ? (
                    <details className="mt-3 border-t border-line pt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-danger">Suspend this business…</summary>
                      <ActionForm action={suspendTenant.bind(null, s.id)} className="mt-3 space-y-2">
                        <p className="text-sm text-muted">
                          It disappears from the app immediately and can't take new bookings.
                          {s.upcoming_confirmed > 0 ? <strong className="text-warn"> {s.upcoming_confirmed} confirmed upcoming booking{s.upcoming_confirmed === 1 ? "" : "s"} stay on the books, so contact the owner.</strong> : null}
                        </p>
                        <textarea name="reason" required minLength={5} maxLength={500} rows={2} placeholder="Reason (the owner will see this)" className={inputClass} />
                        <SubmitButton variant="danger">Suspend business</SubmitButton>
                      </ActionForm>
                    </details>
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
