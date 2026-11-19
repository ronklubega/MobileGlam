import { formatUGX } from "@mobileglam/shared";
import { ActionForm, SubmitButton, inputClass, labelClass } from "@/components/forms";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/dashboard";
import { saveService, setServiceActive } from "../actions";

interface Svc { id: string; name: string; description: string | null; price_ugx: number; duration_minutes: number; deposit_percent: number; allows_home_visit: boolean; is_active: boolean }

function ServiceFields({ s }: { s?: Svc }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className={labelClass}>Name</label><input name="name" required defaultValue={s?.name} className={inputClass} /></div>
      <div className="col-span-2"><label className={labelClass}>Description (optional)</label><input name="description" defaultValue={s?.description ?? ""} className={inputClass} /></div>
      <div><label className={labelClass}>Price (UGX)</label><input name="priceUgx" type="number" min={0} step={500} required defaultValue={s?.price_ugx} className={inputClass} /></div>
      <div><label className={labelClass}>Duration (minutes)</label><input name="durationMinutes" type="number" min={5} max={600} step={5} required defaultValue={s?.duration_minutes ?? 60} className={inputClass} /></div>
      <div><label className={labelClass}>Deposit (%)</label><input name="depositPercent" type="number" min={0} max={100} required defaultValue={s?.deposit_percent ?? 20} className={inputClass} /></div>
      <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="allowsHomeVisit" defaultChecked={s?.allows_home_visit} /> Available as home visit</label>
    </div>
  );
}

export default async function ServicesPage() {
  const ctx = await requireManager();
  const { data } = await ctx.supabase
    .from("services").select("id,name,description,price_ugx,duration_minutes,deposit_percent,allows_home_visit,is_active")
    .eq("tenant_id", ctx.tenant.id).order("name");
  const services = (data ?? []) as unknown as Svc[];

  return (
    <>
      <PageHeader title="Services" />
      <div className="space-y-3">
        {services.length === 0 ? <Empty>No services yet. Add your first one below.</Empty> : services.map((s) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">{s.name} {!s.is_active ? <Badge tone="danger">Hidden</Badge> : null}</p>
                <p className="text-sm text-muted">{formatUGX(Number(s.price_ugx))} · {s.duration_minutes} min · {s.deposit_percent}% deposit{s.allows_home_visit ? " · home visits" : ""}</p>
              </div>
              <ActionForm action={setServiceActive.bind(null, s.id, !s.is_active)}>
                <SubmitButton variant="ghost">{s.is_active ? "Hide from clients" : "Show to clients"}</SubmitButton>
              </ActionForm>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-brand">Edit</summary>
              <ActionForm action={saveService.bind(null, s.id)} className="mt-3"><ServiceFields s={s} /><div className="mt-3"><SubmitButton>Save changes</SubmitButton></div></ActionForm>
            </details>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Add a service</h2>
      <Card><ActionForm action={saveService.bind(null, null)}><ServiceFields /><div className="mt-3"><SubmitButton>Add service</SubmitButton></div></ActionForm></Card>
    </>
  );
}
