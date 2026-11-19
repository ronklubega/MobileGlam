import type { SupabaseClient } from "@supabase/supabase-js";

export interface SetupStep { key: string; label: string; done: boolean; href: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;
const countOf = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

/**
 * What a new business still has to do before it can take bookings. Works with a user-scoped client (dashboard)
 * or the admin client (approvals). The payout step is only meaningful for owners, since managers can't read it.
 */
export async function getSetupSteps(db: Db, tenantId: string, opts: { includePayout: boolean }): Promise<SetupStep[]> {
  const head = { count: "exact", head: true } as const;
  const [services, staff, assigned, shifts, photos, payout] = await Promise.all([
    countOf(db.from("services").select("id", head).eq("tenant_id", tenantId).eq("is_active", true)),
    countOf(db.from("staff").select("id", head).eq("tenant_id", tenantId).eq("is_active", true)),
    countOf(db.from("staff_services").select("staff_id, staff!inner(tenant_id)", head).eq("staff.tenant_id", tenantId)),
    countOf(db.from("staff_shifts").select("id, staff!inner(tenant_id)", head).eq("staff.tenant_id", tenantId)),
    countOf(db.from("tenant_photos").select("id", head).eq("tenant_id", tenantId)),
    opts.includePayout ? countOf(db.from("tenant_payout_details").select("tenant_id", head).eq("tenant_id", tenantId)) : Promise.resolve(1),
  ]);
  const steps: SetupStep[] = [
    { key: "services", label: "Add your services and prices", done: services > 0, href: "/dashboard/services" },
    { key: "staff", label: "Add your stylists or staff", done: staff > 0, href: "/dashboard/staff" },
    { key: "assigned", label: "Choose which services each person does", done: assigned > 0, href: "/dashboard/staff" },
    { key: "shifts", label: "Set weekly working hours", done: shifts > 0, href: "/dashboard/staff" },
    { key: "photos", label: "Upload photos of your business", done: photos > 0, href: "/dashboard/photos" },
  ];
  if (opts.includePayout) steps.push({ key: "payout", label: "Add your mobile money payout number", done: payout > 0, href: "/dashboard/settings" });
  return steps;
}
