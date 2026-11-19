"use server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { payoutSchema } from "@mobileglam/shared";
import { supabaseAdmin } from "@/lib/auth";
import { getContext } from "@/lib/dashboard";
import { coreEnv } from "@/lib/env";
import { generateOtp, hashOtp, maskPhone, verifyOtp } from "@/lib/otp";
import { sendSms } from "@/server/notifications/sms";

export type PayoutResult = { error?: string; ok?: boolean; sentTo?: string };

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 3;
const fail = (error: string): PayoutResult => ({ error });

async function ownerContext() {
  const ctx = await getContext();
  if (!ctx.tenant || ctx.role !== "owner") return null;
  return ctx as typeof ctx & { tenant: NonNullable<typeof ctx.tenant> };
}

/** First-time setup only. Changing an existing number must go through requestPayoutChange/confirmPayoutChange. */
export async function saveFirstPayout(fd: FormData): Promise<PayoutResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("Only the business owner can set payout details.");
  const parsed = payoutSchema.safeParse({ provider: fd.get("provider"), phone: fd.get("phone"), accountName: fd.get("accountName") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details");
  const admin = supabaseAdmin();
  const { data: existing } = await admin.from("tenant_payout_details").select("tenant_id").eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (existing) return fail("Payout details already exist. Use “Change payout number”.");
  const { error } = await admin.from("tenant_payout_details").insert({
    tenant_id: ctx.tenant.id, provider: parsed.data.provider, phone: parsed.data.phone, account_name: parsed.data.accountName, updated_by: ctx.user.id,
  });
  if (error) return fail("Couldn't save. Please try again.");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/** Step 1: verify the owner's password, then text a code to the NEW number to prove they control it. */
export async function requestPayoutChange(fd: FormData): Promise<PayoutResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("Only the business owner can change payout details.");
  if (!ctx.user.email) return fail("Your account has no email, so password confirmation isn't possible. Contact support.");

  const parsed = payoutSchema.safeParse({ provider: fd.get("provider"), phone: fd.get("phone"), accountName: fd.get("accountName") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details");
  const password = String(fd.get("password") ?? "");
  if (!password) return fail("Enter your account password to continue.");

  const admin = supabaseAdmin();
  const { data: current } = await admin.from("tenant_payout_details").select("provider,phone,account_name").eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (!current) return fail("Set your payout details first.");
  if (current.provider === parsed.data.provider && current.phone === parsed.data.phone && current.account_name === parsed.data.accountName) {
    return fail("Those are already your payout details.");
  }

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin.from("payout_change_requests").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenant.id).gte("created_at", since);
  if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) return fail("Too many attempts. Please try again in an hour.");

  // Re-authenticate with a throwaway client so this never touches the user's real session.
  const env = coreEnv();
  const verifier = createClient(env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: pwError } = await verifier.auth.signInWithPassword({ email: ctx.user.email, password });
  if (pwError) return fail("Incorrect password.");

  const code = generateOtp();
  await admin.from("payout_change_requests").delete().eq("tenant_id", ctx.tenant.id); // only one pending change at a time
  const { data: reqRow, error: insertError } = await admin.from("payout_change_requests").insert({
    tenant_id: ctx.tenant.id, requested_by: ctx.user.id, provider: parsed.data.provider, phone: parsed.data.phone,
    account_name: parsed.data.accountName, code_hash: "pending", expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  }).select("id").single();
  if (insertError || !reqRow) return fail("Couldn't start the change. Please try again.");
  await admin.from("payout_change_requests").update({ code_hash: hashOtp(env.SUPABASE_SERVICE_ROLE_KEY, reqRow.id as string, code) }).eq("id", reqRow.id);

  try {
    await sendSms(parsed.data.phone, `MobileGlam: code ${code} confirms the new payout number for ${ctx.tenant.name}. Expires in 10 minutes. Never share it.`);
  } catch (e) {
    console.error("[payout] sms failed", e);
    await admin.from("payout_change_requests").delete().eq("id", reqRow.id);
    return fail("We couldn't send the code to that number. Check it and try again.");
  }
  return { ok: true, sentTo: maskPhone(parsed.data.phone) };
}

/** Step 2: check the code; only then apply the change and warn the previous number. */
export async function confirmPayoutChange(fd: FormData): Promise<PayoutResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("Only the business owner can change payout details.");
  const code = String(fd.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return fail("Enter the 6-digit code.");

  const admin = supabaseAdmin();
  const { data: req } = await admin.from("payout_change_requests").select("*")
    .eq("tenant_id", ctx.tenant.id).eq("requested_by", ctx.user.id).gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!req) return fail("That code has expired. Start the change again.");
  if (req.attempts >= MAX_ATTEMPTS) {
    await admin.from("payout_change_requests").delete().eq("id", req.id);
    return fail("Too many wrong codes. Start the change again.");
  }
  // Optimistic lock: parallel guesses can't squeeze extra attempts past the cap.
  const { data: bumped } = await admin.from("payout_change_requests").update({ attempts: req.attempts + 1 }).eq("id", req.id).eq("attempts", req.attempts).select("id");
  if (!bumped?.length) return fail("Please try again.");

  if (!verifyOtp(coreEnv().SUPABASE_SERVICE_ROLE_KEY, req.id as string, code, req.code_hash as string)) {
    return fail(`Incorrect code. ${MAX_ATTEMPTS - req.attempts - 1} attempt${MAX_ATTEMPTS - req.attempts - 1 === 1 ? "" : "s"} left.`);
  }

  const { data: old } = await admin.from("tenant_payout_details").select("phone").eq("tenant_id", ctx.tenant.id).maybeSingle();
  const { error } = await admin.from("tenant_payout_details").upsert({
    tenant_id: ctx.tenant.id, provider: req.provider, phone: req.phone, account_name: req.account_name,
    updated_at: new Date().toISOString(), updated_by: ctx.user.id,
  });
  if (error) return fail("Couldn't apply the change. Please try again.");
  await admin.from("payout_change_requests").delete().eq("tenant_id", ctx.tenant.id);

  if (old?.phone && old.phone !== req.phone) {
    sendSms(old.phone as string, `MobileGlam: the payout number for ${ctx.tenant.name} was changed to ${maskPhone(req.phone as string)}. If this wasn't you, contact support immediately.`)
      .catch((e) => console.error("[payout] old-number notice failed", e));
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
