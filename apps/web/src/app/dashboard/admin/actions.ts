"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/auth";
import { getContext } from "@/lib/dashboard";
import { atLeast, audit, bootstrapEmails, type PlatformRole } from "@/lib/platform";
import type { ActionState } from "@/components/forms";

const ok = (): ActionState => ({ ok: true });
const fail = (error: string): ActionState => ({ error });
const roleSchema = z.enum(["super_admin", "admin", "support"]);

/** Every operator action starts here: the caller must hold at least `min`, checked on the server. */
async function operator(min: PlatformRole) {
  const ctx = await getContext();
  return atLeast(ctx.platformRole, min) ? ctx : null;
}

// ---------- business lifecycle ----------
export async function approveTenant(tenantId: string, _p: ActionState, _f: FormData): Promise<ActionState> {
  const ctx = await operator("admin");
  if (!ctx) return fail("You don't have permission to approve businesses.");
  const { data, error } = await supabaseAdmin().from("tenants")
    .update({ is_active: true, approved_at: new Date().toISOString() })
    .eq("id", tenantId).eq("is_active", false).is("suspended_at", null).select("id,name");
  if (error) return fail(error.message);
  if (!data?.length) return fail("This business is no longer pending.");
  await audit(ctx.user, "tenant.approve", { type: "tenant", id: tenantId }, { name: data[0]?.name });
  revalidatePath("/dashboard", "layout");
  return ok();
}

export async function suspendTenant(tenantId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await operator("admin");
  if (!ctx) return fail("You don't have permission to suspend businesses.");
  const reason = z.string().trim().min(5, "Give a reason (at least 5 characters). The owner will see it.").max(500).safeParse(fd.get("reason"));
  if (!reason.success) return fail(reason.error.issues[0]?.message ?? "Enter a reason");
  const admin = supabaseAdmin();
  const { count: upcoming } = await admin.from("bookings").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("status", "confirmed").gt("starts_at", new Date().toISOString());
  const { data, error } = await admin.from("tenants")
    .update({ is_active: false, suspended_at: new Date().toISOString(), suspension_reason: reason.data, suspended_by: ctx.user.id })
    .eq("id", tenantId).is("suspended_at", null).select("id,name");
  if (error) return fail(error.message);
  if (!data?.length) return fail("This business is already suspended.");
  await audit(ctx.user, "tenant.suspend", { type: "tenant", id: tenantId }, { name: data[0]?.name, reason: reason.data, upcoming_confirmed_bookings: upcoming ?? 0 });
  revalidatePath("/dashboard", "layout");
  return ok();
}

export async function reinstateTenant(tenantId: string, _p: ActionState, _f: FormData): Promise<ActionState> {
  const ctx = await operator("admin");
  if (!ctx) return fail("You don't have permission to reinstate businesses.");
  const { data, error } = await supabaseAdmin().from("tenants")
    .update({ is_active: true, suspended_at: null, suspension_reason: null, suspended_by: null })
    .eq("id", tenantId).not("suspended_at", "is", null).select("id,name");
  if (error) return fail(error.message);
  if (!data?.length) return fail("This business isn't suspended.");
  await audit(ctx.user, "tenant.reinstate", { type: "tenant", id: tenantId }, { name: data[0]?.name });
  revalidatePath("/dashboard", "layout");
  return ok();
}

// ---------- refunds ----------
export async function markRefunded(paymentId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await operator("admin");
  if (!ctx) return fail("You don't have permission to record refunds.");
  const reference = typeof fd.get("reference") === "string" ? String(fd.get("reference")).trim() : "";
  if (!reference) return fail("Enter the refund transaction reference.");
  const { data, error } = await supabaseAdmin().from("payments")
    .update({ refunded_at: new Date().toISOString(), refund_reference: reference.slice(0, 120) })
    .eq("id", paymentId).is("refunded_at", null).select("id,amount_ugx");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Already marked as refunded.");
  await audit(ctx.user, "payment.refund", { type: "payment", id: paymentId }, { amount_ugx: data[0]?.amount_ugx, reference });
  revalidatePath("/dashboard/refunds");
  return ok();
}

// ---------- platform admins ----------
export type CreateAdminResult = { error?: string; ok?: boolean; email?: string; tempPassword?: string; existing?: boolean };

export async function createAdmin(fd: FormData): Promise<CreateAdminResult> {
  const ctx = await operator("super_admin");
  if (!ctx) return { error: "Only super admins can create admin accounts." };
  const parsed = z.object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    fullName: z.string().trim().max(80).optional(),
    role: roleSchema,
  }).safeParse({ email: fd.get("email"), fullName: String(fd.get("fullName") ?? "").trim() || undefined, role: fd.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { email, fullName, role } = parsed.data;
  const admin = supabaseAdmin();

  const { data: existingId } = await admin.rpc("admin_find_user_by_email", { p_email: email });
  let userId = existingId as string | null;
  let tempPassword: string | undefined;

  if (userId) {
    const { data: already } = await admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (already) return { error: "That person is already a platform admin. Change their role from the list instead." };
  } else {
    // No email service yet, so a one-time password is shown to the creator, and the new admin must replace it at first sign-in.
    tempPassword = randomBytes(9).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
      user_metadata: { full_name: fullName ?? null, must_change_password: true },
    });
    if (error || !data.user) return { error: "Couldn't create that account. Please try again." };
    userId = data.user.id;
  }

  const { error } = await admin.from("platform_admins").insert({ user_id: userId, role, created_by: ctx.user.id });
  if (error) {
    if (tempPassword) await admin.auth.admin.deleteUser(userId); // don't leave an orphan account
    return { error: "Couldn't grant the role. Please try again." };
  }
  await audit(ctx.user, "admin.create", { type: "user", id: userId }, { email, role, new_account: !!tempPassword });
  revalidatePath("/dashboard/admin/admins");
  return { ok: true, email, tempPassword, existing: !tempPassword };
}

/** Never leave the platform without a super admin we can't lock out (env bootstrap emails count as one). */
async function wouldOrphanSuperAdmins(userId: string) {
  if (bootstrapEmails().length > 0) return false;
  const { data } = await supabaseAdmin().from("platform_admins").select("user_id").eq("role", "super_admin");
  return !(data ?? []).some((r) => r.user_id !== userId);
}

export async function changeAdminRole(userId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await operator("super_admin");
  if (!ctx) return fail("Only super admins can change roles.");
  if (userId === ctx.user.id) return fail("You can't change your own role.");
  const role = roleSchema.safeParse(fd.get("role"));
  if (!role.success) return fail("Choose a role.");
  const admin = supabaseAdmin();
  const { data: current } = await admin.from("platform_admins").select("role").eq("user_id", userId).maybeSingle();
  if (!current) return fail("Admin not found.");
  if (current.role === "super_admin" && role.data !== "super_admin" && (await wouldOrphanSuperAdmins(userId))) return fail("There must always be at least one super admin.");
  const { error } = await admin.from("platform_admins").update({ role: role.data }).eq("user_id", userId);
  if (error) return fail(error.message);
  await audit(ctx.user, "admin.role_change", { type: "user", id: userId }, { from: current.role, to: role.data });
  revalidatePath("/dashboard/admin/admins");
  return ok();
}

export async function removeAdmin(userId: string, _p: ActionState, _f: FormData): Promise<ActionState> {
  const ctx = await operator("super_admin");
  if (!ctx) return fail("Only super admins can remove admins.");
  if (userId === ctx.user.id) return fail("You can't remove yourself.");
  const admin = supabaseAdmin();
  const { data: current } = await admin.from("platform_admins").select("role").eq("user_id", userId).maybeSingle();
  if (!current) return fail("Admin not found.");
  if (current.role === "super_admin" && (await wouldOrphanSuperAdmins(userId))) return fail("There must always be at least one super admin.");
  const { error } = await admin.from("platform_admins").delete().eq("user_id", userId);
  if (error) return fail(error.message);
  await audit(ctx.user, "admin.remove", { type: "user", id: userId }, { role: current.role });
  revalidatePath("/dashboard/admin/admins");
  return ok();
}
