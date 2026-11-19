"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { createTenantSchema, payoutSchema } from "@mobileglam/shared";
import { supabaseAdmin } from "@/lib/auth";
import { getContext } from "@/lib/dashboard";
import type { ActionState } from "@/components/forms";

const MAX_BUSINESSES_PER_USER = 3;
const num = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const slugify = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "business";

/**
 * Self-registration. Runs with the service role because tenants have no client-side INSERT policy by design.
 * New businesses start inactive (hidden from clients and unbookable) until a platform admin approves them.
 */
export async function createTenant(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getContext();
  const parsed = createTenantSchema.safeParse({
    name: fd.get("name"), type: fd.get("type"),
    description: typeof fd.get("description") === "string" && String(fd.get("description")).trim() ? String(fd.get("description")).trim() : undefined,
    address: fd.get("address"), area: fd.get("area"), offersHomeVisits: fd.get("offersHomeVisits") === "on",
    latitude: num(fd.get("latitude")), longitude: num(fd.get("longitude")),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.path[0] === "latitude" || issue?.path[0] === "longitude" ? (Number.isNaN(num(fd.get("latitude"))) ? "Set your location: tap “Use my current location”." : issue.message) : (issue?.message ?? "Invalid input") };
  }
  const v = parsed.data;
  const payout = payoutSchema.safeParse({ provider: fd.get("provider"), phone: fd.get("payoutPhone"), accountName: fd.get("accountName") });
  if (!payout.success) return { error: payout.error.issues[0]?.message ?? "Check your payout details" };
  const admin = supabaseAdmin();

  const { count } = await admin.from("tenant_members").select("tenant_id", { count: "exact", head: true }).eq("user_id", ctx.user.id).eq("role", "owner");
  if ((count ?? 0) >= MAX_BUSINESSES_PER_USER) return { error: `You can register up to ${MAX_BUSINESSES_PER_USER} businesses.` };

  let tenantId: string | null = null;
  for (let attempt = 0; attempt < 3 && !tenantId; attempt++) {
    const { data, error } = await admin.from("tenants").insert({
      name: v.name, slug: `${slugify(v.name)}-${randomBytes(2).toString("hex")}`, type: v.type,
      description: v.description ?? null, address: v.address, area: v.area, offers_home_visits: v.offersHomeVisits,
      location: `SRID=4326;POINT(${v.longitude} ${v.latitude})`, is_active: false,
    }).select("id").single();
    if (!error) tenantId = data.id as string;
    else if (error.code !== "23505") return { error: "Couldn't create your business. Please try again." };
  }
  if (!tenantId) return { error: "Couldn't create your business. Please try again." };

  const { error: memberError } = await admin.from("tenant_members").insert({ tenant_id: tenantId, user_id: ctx.user.id, role: "owner" });
  const { error: payoutError } = memberError ? { error: null } : await admin.from("tenant_payout_details").insert({
    tenant_id: tenantId, provider: payout.data.provider, phone: payout.data.phone, account_name: payout.data.accountName, updated_by: ctx.user.id,
  });
  if (memberError || payoutError) {
    await admin.from("tenants").delete().eq("id", tenantId); // don't leave an orphan
    return { error: "Couldn't finish setup. Please try again." };
  }
  redirect("/dashboard");
}
