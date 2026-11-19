import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "./auth";

export type PlatformRole = "super_admin" | "admin" | "support";
const RANK: Record<PlatformRole, number> = { support: 1, admin: 2, super_admin: 3 };
export const ROLE_LABEL: Record<PlatformRole, string> = { super_admin: "Super admin", admin: "Admin", support: "Support (read-only)" };

/** Emails in PLATFORM_ADMIN_EMAILS are always super admins: a safety net so you can never lock yourself out. */
export const bootstrapEmails = () => (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export const atLeast = (role: PlatformRole | null | undefined, min: PlatformRole) => !!role && RANK[role] >= RANK[min];

export const getPlatformRole = cache(async (userId: string, email?: string | null): Promise<PlatformRole | null> => {
  if (email && bootstrapEmails().includes(email.toLowerCase())) return "super_admin";
  const { data } = await supabaseAdmin().from("platform_admins").select("role").eq("user_id", userId).maybeSingle();
  return (data?.role as PlatformRole | undefined) ?? null;
});

/** Append-only record of sensitive operator actions. Never throws: auditing must not mask the action's own result. */
export async function audit(actor: { id: string; email?: string | null }, action: string, target?: { type: string; id: string }, details: Record<string, unknown> = {}) {
  const { error } = await supabaseAdmin().from("admin_audit_log").insert({
    actor_id: actor.id, actor_email: actor.email ?? null, action, target_type: target?.type ?? null, target_id: target?.id ?? null, details,
  });
  if (error) console.error("[audit] failed to record", action, error.message);
}

/** For pages: returns the signed-in operator or redirects away. */
export async function requirePlatformRole<T extends { platformRole: PlatformRole | null }>(ctx: T, min: PlatformRole): Promise<T & { platformRole: PlatformRole }> {
  if (!atLeast(ctx.platformRole, min)) redirect("/dashboard");
  return ctx as T & { platformRole: PlatformRole };
}
