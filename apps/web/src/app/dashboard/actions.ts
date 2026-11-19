"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientNoteSchema, createServiceSchema } from "@glamdesk/shared";
import { getContext, type DashboardContext } from "@/lib/dashboard";
import type { ActionState } from "@/components/forms";

const ok = (): ActionState => ({ ok: true });
const fail = (error: string): ActionState => ({ error });
const friendly = (msg: string) => (/row-level security|permission denied/i.test(msg) ? "You don't have permission to do that." : msg);
const optional = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

type Ready = DashboardContext & { tenant: NonNullable<DashboardContext["tenant"]>; role: NonNullable<DashboardContext["role"]> };
async function context(managerOnly = false): Promise<Ready | string> {
  const ctx = await getContext();
  if (!ctx.tenant || !ctx.role) return "No salon selected";
  if (managerOnly && ctx.role === "staff") return "Only owners and managers can do that.";
  return ctx as Ready;
}

export async function signOut() {
  const { supabase } = await getContext();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function switchTenant(formData: FormData) {
  const ctx = await getContext();
  const id = String(formData.get("tenantId") ?? "");
  if (ctx.memberships.some((m) => m.tenant.id === id)) {
    (await cookies()).set("tenant_id", id, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  revalidatePath("/dashboard", "layout");
}

// ---------- bookings ----------
export async function updateBookingStatus(bookingId: string, next: "completed" | "no_show" | "cancelled", _p: ActionState, _f: FormData): Promise<ActionState> {
  const ctx = await context();
  if (typeof ctx === "string") return fail(ctx);
  const { data: b } = await ctx.supabase
    .from("bookings").select("status,starts_at").eq("id", bookingId).eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (!b) return fail("Booking not found");
  if (b.status !== "confirmed") return fail("Only confirmed bookings can be changed.");
  if (next !== "cancelled" && new Date(b.starts_at).getTime() > Date.now() + 30 * 60_000) {
    return fail("This appointment hasn't started yet.");
  }
  const { error, count } = await ctx.supabase
    .from("bookings").update({ status: next }, { count: "exact" }).eq("id", bookingId).eq("status", "confirmed");
  if (error) return fail(friendly(error.message));
  if (!count) return fail("Couldn't update. Refresh and try again.");
  revalidatePath("/dashboard");
  return ok();
}

// ---------- services ----------
export async function saveService(serviceId: string | null, _p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await context(true);
  if (typeof ctx === "string") return fail(ctx);
  const parsed = createServiceSchema.safeParse({
    tenantId: ctx.tenant.id,
    name: fd.get("name"),
    description: optional(fd.get("description")),
    priceUgx: Number(fd.get("priceUgx")),
    durationMinutes: Number(fd.get("durationMinutes")),
    depositPercent: Number(fd.get("depositPercent")),
    allowsHomeVisit: fd.get("allowsHomeVisit") === "on",
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  const row = {
    name: v.name, description: v.description ?? null, price_ugx: v.priceUgx, duration_minutes: v.durationMinutes,
    deposit_percent: v.depositPercent, allows_home_visit: v.allowsHomeVisit,
  };
  const { error } = serviceId
    ? await ctx.supabase.from("services").update(row).eq("id", serviceId).eq("tenant_id", ctx.tenant.id)
    : await ctx.supabase.from("services").insert({ ...row, tenant_id: ctx.tenant.id });
  if (error) return fail(friendly(error.message));
  revalidatePath("/dashboard/services");
  return ok();
}

export async function setServiceActive(serviceId: string, active: boolean, _p: ActionState, _f: FormData): Promise<ActionState> {
  const ctx = await context(true);
  if (typeof ctx === "string") return fail(ctx);
  const { error } = await ctx.supabase.from("services").update({ is_active: active }).eq("id", serviceId).eq("tenant_id", ctx.tenant.id);
  if (error) return fail(friendly(error.message));
  revalidatePath("/dashboard/services");
  return ok();
}

// ---------- staff ----------
const staffSchema = z.object({ displayName: z.string().trim().min(2, "Enter a name").max(80), title: z.string().trim().max(80).optional() });

export async function saveStaff(staffId: string | null, _p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await context(true);
  if (typeof ctx === "string") return fail(ctx);
  const parsed = staffSchema.safeParse({ displayName: fd.get("displayName"), title: optional(fd.get("title")) });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const row = { display_name: parsed.data.displayName, title: parsed.data.title ?? null };
  const { error } = staffId
    ? await ctx.supabase.from("staff").update(row).eq("id", staffId).eq("tenant_id", ctx.tenant.id)
    : await ctx.supabase.from("staff").insert({ ...row, tenant_id: ctx.tenant.id });
  if (error) return fail(friendly(error.message));
  revalidatePath("/dashboard/staff");
  return ok();
}

export async function setStaffActive(staffId: string, active: boolean, _p: ActionState, _f: FormData): Promise<ActionState> {
  const ctx = await context(true);
  if (typeof ctx === "string") return fail(ctx);
  const { error } = await ctx.supabase.from("staff").update({ is_active: active }).eq("id", staffId).eq("tenant_id", ctx.tenant.id);
  if (error) return fail(friendly(error.message));
  revalidatePath("/dashboard/staff");
  return ok();
}

export async function saveStaffServices(staffId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await context(true);
  if (typeof ctx === "string") return fail(ctx);
  const ids = z.array(z.string().uuid()).safeParse(fd.getAll("serviceId"));
  if (!ids.success) return fail("Invalid service selection");
  // Only services/staff belonging to this salon.
  const [{ data: staffRow }, { data: svcRows }] = await Promise.all([
    ctx.supabase.from("staff").select("id").eq("id", staffId).eq("tenant_id", ctx.tenant.id).maybeSingle(),
    ctx.supabase.from("services").select("id").eq("tenant_id", ctx.tenant.id).in("id", ids.data.length ? ids.data : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  if (!staffRow) return fail("Staff member not found");
  const valid = (svcRows ?? []).map((s) => s.id as string);
  // Insert first, then prune, so the staff member is never left without services mid-way.
  if (valid.length) {
    const { error } = await ctx.supabase.from("staff_services").upsert(valid.map((service_id) => ({ staff_id: staffId, service_id })), { onConflict: "staff_id,service_id", ignoreDuplicates: true });
    if (error) return fail(friendly(error.message));
  }
  const prune = ctx.supabase.from("staff_services").delete().eq("staff_id", staffId);
  const { error } = await (valid.length ? prune.not("service_id", "in", `(${valid.join(",")})`) : prune);
  if (error) return fail(friendly(error.message));
  revalidatePath("/dashboard/staff");
  return ok();
}

const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
export async function saveShifts(staffId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await context(true);
  if (typeof ctx === "string") return fail(ctx);
  const shifts: { weekday: number; start: string; end: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (fd.get(`on${d}`) !== "on") continue;
    const start = String(fd.get(`start${d}`) ?? "");
    const end = String(fd.get(`end${d}`) ?? "");
    if (!hhmm.test(start) || !hhmm.test(end)) return fail("Enter valid start and end times.");
    if (start >= end) return fail("Each shift must end after it starts.");
    shifts.push({ weekday: d, start, end });
  }
  const { data: staffRow } = await ctx.supabase.from("staff").select("id").eq("id", staffId).eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (!staffRow) return fail("Staff member not found");
  const { error } = await ctx.supabase.rpc("replace_staff_shifts", { p_staff: staffId, p_shifts: shifts });
  if (error) return fail(friendly(error.message));
  revalidatePath("/dashboard/staff");
  return ok();
}

// ---------- clients ----------
export async function addClientNote(clientId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await context();
  if (typeof ctx === "string") return fail(ctx);
  const parsed = clientNoteSchema.safeParse({ tenantId: ctx.tenant.id, clientId, note: fd.get("note") });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { error } = await ctx.supabase.from("client_notes").insert({
    tenant_id: ctx.tenant.id, client_id: clientId, author_id: ctx.user.id, note: parsed.data.note,
  });
  if (error) return fail(friendly(error.message));
  revalidatePath(`/dashboard/clients/${clientId}`);
  return ok();
}

// ---------- business photos ----------
export async function deletePhoto(photoId: string, _p: ActionState, _f: FormData): Promise<ActionState> {
  const ctx = await context(true);
  if (typeof ctx === "string") return fail(ctx);
  const { data: photo } = await ctx.supabase.from("tenant_photos").select("path").eq("id", photoId).eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (!photo) return fail("Photo not found");
  const { error } = await ctx.supabase.from("tenant_photos").delete().eq("id", photoId).eq("tenant_id", ctx.tenant.id);
  if (error) return fail(friendly(error.message));
  await ctx.supabase.storage.from("tenant-photos").remove([photo.path as string]); // best effort; row is already gone
  revalidatePath("/dashboard/photos");
  return ok();
}

export async function makeCoverPhoto(photoId: string, _p: ActionState, _f: FormData): Promise<ActionState> {
  const ctx = await context(true);
  if (typeof ctx === "string") return fail(ctx);
  const { data: first } = await ctx.supabase.from("tenant_photos").select("position").eq("tenant_id", ctx.tenant.id).order("position").limit(1).maybeSingle();
  const { error } = await ctx.supabase.from("tenant_photos").update({ position: ((first?.position as number | undefined) ?? 0) - 1 }).eq("id", photoId).eq("tenant_id", ctx.tenant.id);
  if (error) return fail(friendly(error.message));
  revalidatePath("/dashboard/photos");
  return ok();
}

// ---------- business settings ----------
const businessSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
  description: z.string().trim().max(1000).optional(),
  address: z.string().trim().min(1, "Enter your address").max(200),
  area: z.string().trim().min(1, "Enter your area").max(80),
  offersHomeVisits: z.boolean(),
});

export async function updateBusiness(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await context(true);
  if (typeof ctx === "string") return fail(ctx);
  const parsed = businessSchema.safeParse({
    name: fd.get("name"), description: optional(fd.get("description")), address: fd.get("address"), area: fd.get("area"),
    offersHomeVisits: fd.get("offersHomeVisits") === "on",
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  // Column-level grants (migration 0007) mean only these fields are writable here, never is_active or commission.
  const { error } = await ctx.supabase.from("tenants")
    .update({ name: v.name, description: v.description ?? null, address: v.address, area: v.area, offers_home_visits: v.offersHomeVisits })
    .eq("id", ctx.tenant.id);
  if (error) return fail(friendly(error.message));
  revalidatePath("/dashboard", "layout");
  return ok();
}
