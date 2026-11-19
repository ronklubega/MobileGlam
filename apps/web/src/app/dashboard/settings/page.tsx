import { ActionForm, SubmitButton, inputClass, labelClass } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/dashboard";
import { updateBusiness } from "../actions";
import { ChangePayoutForm, FirstPayoutForm } from "./payout-forms";

export default async function SettingsPage() {
  const ctx = await requireManager();
  const [{ data: t }, { data: payout }] = await Promise.all([
    ctx.supabase.from("tenants").select("name,description,address,area,offers_home_visits,commission_bps").eq("id", ctx.tenant.id).single(),
    ctx.role === "owner" ? ctx.supabase.from("tenant_payout_details").select("provider,phone,account_name").eq("tenant_id", ctx.tenant.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const b = t as { name: string; description: string | null; address: string | null; area: string | null; offers_home_visits: boolean; commission_bps: number } | null;
  const p = payout as { provider: "mtn_momo" | "airtel_money"; phone: string; account_name: string } | null;

  return (
    <>
      <PageHeader title="Settings" />
      <h2 className="mb-2 text-lg font-bold">Business details</h2>
      <Card className="mb-8">
        <ActionForm action={updateBusiness} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={labelClass}>Business name</label><input name="name" required defaultValue={b?.name} maxLength={120} className={inputClass} /></div>
          <div className="sm:col-span-2"><label className={labelClass}>Description</label><textarea name="description" rows={3} defaultValue={b?.description ?? ""} maxLength={1000} className={inputClass} /></div>
          <div><label className={labelClass}>Area</label><input name="area" required defaultValue={b?.area ?? ""} maxLength={80} className={inputClass} /></div>
          <div><label className={labelClass}>Street address / landmark</label><input name="address" required defaultValue={b?.address ?? ""} maxLength={200} className={inputClass} /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="offersHomeVisits" defaultChecked={b?.offers_home_visits} /> We offer home / mobile visits</label>
          <div className="sm:col-span-2"><SubmitButton>Save details</SubmitButton></div>
        </ActionForm>
        <p className="mt-3 text-xs text-muted">Platform commission on deposits: {(b?.commission_bps ?? 0) / 100}%. To change your map location, contact MobileGlam support.</p>
      </Card>

      <h2 className="mb-2 text-lg font-bold">Payout details</h2>
      {ctx.role !== "owner" ? <Card><p className="text-sm text-muted">Only the business owner can view or change payout details.</p></Card> : (
        <Card>
          <p className="mb-3 text-sm text-muted">Deposits (minus commission) are paid to this mobile money account. The number must be registered under your business or you.</p>
          {p ? <ChangePayoutForm current={p} /> : <FirstPayoutForm />}
        </Card>
      )}
    </>
  );
}
