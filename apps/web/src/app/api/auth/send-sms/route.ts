import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { normalizeUgPhone } from "@mobileglam/shared";
import { smsHookEnv } from "@/lib/env";
import { verifyStandardWebhook } from "@/lib/standard-webhook";
import { sendSms } from "@/server/notifications/sms";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  user: z.object({ phone: z.string().min(8) }),
  sms: z.object({ otp: z.string().regex(/^\d{4,10}$/) }),
});

/** Supabase's error contract for Auth Hooks: a non-2xx with this body makes the sign-in attempt fail visibly. */
const hookError = (status: number, message: string) => NextResponse.json({ error: { http_code: status, message } }, { status });

/**
 * Supabase "Send SMS" Auth Hook. Supabase calls this instead of Twilio whenever it needs to deliver an OTP,
 * so codes go out through Africa's Talking. Only Ugandan mobile numbers are served, which also blocks
 * SMS-pumping fraud against foreign premium-rate numbers.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const valid = verifyStandardWebhook({
    id: req.headers.get("webhook-id"),
    timestamp: req.headers.get("webhook-timestamp"),
    signature: req.headers.get("webhook-signature"),
    body: raw,
    secret: smsHookEnv().SEND_SMS_HOOK_SECRET,
  });
  if (!valid) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let json: unknown;
  try { json = JSON.parse(raw); } catch { return hookError(400, "Invalid JSON"); }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return hookError(400, "Unexpected payload");

  // Supabase sends the number without '+'. Normalise and require a Ugandan mobile.
  const phone = normalizeUgPhone(parsed.data.user.phone);
  if (!phone) return hookError(400, "Phone sign-in is only available for Ugandan mobile numbers.");

  try {
    await sendSms(phone, `Your MobileGlam code is ${parsed.data.sms.otp}. It expires in 5 minutes. Never share it with anyone.`);
  } catch (e) {
    console.error("[send-sms hook] delivery failed", e);
    return hookError(502, "Couldn't send the SMS. Please try again.");
  }
  return NextResponse.json({});
}
