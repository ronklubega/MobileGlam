import { redirect } from "next/navigation";
import { formatDay } from "@mobileglam/shared";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { supabaseAdmin } from "@/lib/auth";
import { getContext } from "@/lib/dashboard";
import { getSetupSteps } from "@/lib/setup";
import { approveTenant } from "../admin/actions";
import { atLeast } from "@/lib/platform";

interface Row {
  id: string; name: string; type: string; area: string | null; address: string | null; description: string | null; created_at: string;
  offers_home_visits: boolean; tenant_members: { user_id: string; profiles: { full_name: string | null } | null }[];
}

export default async function ApprovalsPage() {
  const ctx = await getContext();
  if (!ctx.platformAdmin) redirect("/dashboard");
  const canApprove = atLeast(ctx.platformRole, "admin");
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("tenants").select("id,name,type,area,address,description,created_at,offers_home_visits,tenant_members(user_id,profiles(full_name))")
    .eq("is_active", false).is("suspended_at", null).order("created_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const owners = await Promise.all(rows.map(async (r) => {
    const uid = r.tenant_members[0]?.user_id;
    const email = uid ? (await admin.auth.admin.getUserById(uid)).data.user?.email : null;
    return [r.id, email ?? "unknown"] as const;
  }));
  const emailOf = new Map(owners);
  const extras = new Map(await Promise.all(rows.map(async (r) => {
    const [steps, payout] = await Promise.all([
      getSetupSteps(admin, r.id, { includePayout: true }),
      admin.from("tenant_payout_details").select("provider,phone").eq("tenant_id", r.id).maybeSingle(),
    ]);
    return [r.id, { steps, payout: payout.data as { provider: string; phone: string } | null }] as const;
  })));

  return (
    <>
      <PageHeader title="Pending approvals" />
      {rows.length === 0 ? <Empty>No businesses waiting for approval.</Empty> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{r.name} <Badge tone="neutral">{r.type}</Badge></p>
                    <p className="text-sm text-muted">{[r.address, r.area].filter(Boolean).join(", ")}{r.offers_home_visits ? " · home visits" : ""}</p>
                    {r.description ? <p className="mt-2 text-sm">{r.description}</p> : null}
                    {(() => {
                      const x = extras.get(r.id);
                      const todo = x?.steps.filter((st) => !st.done).map((st) => st.label) ?? [];
                      return (
                        <>
                          <p className="mt-2 text-sm">Payout: {x?.payout ? `${x.payout.provider === "mtn_momo" ? "MTN" : "Airtel"} ${x.payout.phone}` : "not provided"}</p>
                          <p className={`mt-1 text-sm ${todo.length ? "text-warn" : "text-success"}`}>
                            {todo.length ? `Not ready yet: ${todo.join("; ")}` : "Setup complete: services, staff, hours, photos and payout are all in place."}
                          </p>
                        </>
                      );
                    })()}
                    <p className="mt-2 text-xs text-muted">Owner: {r.tenant_members[0]?.profiles?.full_name ?? "—"} · {emailOf.get(r.id)} · registered {formatDay(r.created_at)}</p>
                  </div>
                  {canApprove ? <ActionForm action={approveTenant.bind(null, r.id)}><SubmitButton>Approve &amp; publish</SubmitButton></ActionForm> : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
