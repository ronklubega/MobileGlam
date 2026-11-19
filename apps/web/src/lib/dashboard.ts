import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getPlatformRole, type PlatformRole } from "./platform";
import { supabaseServer } from "./supabase/server";

export type Role = "owner" | "manager" | "staff";
export interface TenantRef { id: string; name: string; type: string; commission_bps: number; is_active: boolean; suspended_at: string | null; suspension_reason: string | null }
export interface Membership { role: Role; tenant: TenantRef }

/** Signed-in user + the salon they're currently managing. Every query made through `supabase` is RLS-scoped to this user. */
export const getContext = cache(async function getContext() {
  const supabase = await supabaseServer();
  // Local JWT verification: no round trip to Supabase Auth. Middleware has already refreshed the session.
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const user = { id: auth.claims.sub, email: (auth.claims.email as string | undefined) ?? null };
  const meta = (auth.claims.user_metadata ?? {}) as { full_name?: string };
  const platformRole: PlatformRole | null = await getPlatformRole(user.id, user.email);

  const { data, error } = await supabase
    .from("tenant_members")
    .select("role, tenants(id,name,type,commission_bps,is_active,suspended_at,suspension_reason)")
    .eq("user_id", user.id);
  if (error) throw new Error(`Couldn't load your salons: ${error.message}`);

  const memberships = (data ?? [])
    .map((m) => ({ role: m.role as Role, tenant: m.tenants as unknown as TenantRef }))
    .filter((m): m is Membership => !!m.tenant);

  const wanted = (await cookies()).get("tenant_id")?.value;
  const current = memberships.find((m) => m.tenant.id === wanted) ?? memberships[0] ?? null;
  return {
    supabase, user, memberships, current,
    tenant: current?.tenant ?? null,
    role: current?.role ?? null,
    platformRole,
    platformAdmin: platformRole !== null,
    displayName: meta.full_name ?? null,
  };
});
export type DashboardContext = Awaited<ReturnType<typeof getContext>>;

/** For pages restricted to owners/managers. Returns the context with a guaranteed tenant. */
export async function requireManager() {
  const ctx = await getContext();
  if (!ctx.tenant || !ctx.role) redirect("/dashboard");
  if (ctx.role === "staff") redirect("/dashboard");
  return { ...ctx, tenant: ctx.tenant, role: ctx.role };
}
