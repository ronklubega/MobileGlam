import { smsEnv } from "@/lib/env";

/** Africa's Talking SMS. Throws on failure so callers can retry or log. */
export async function sendSms(toE164: string, message: string): Promise<void> {
  // Local development without Africa's Talking credentials: print instead of sending.
  if (!process.env.AT_API_KEY && process.env.NODE_ENV !== "production") {
    console.log(`[sms:dev] to ${toE164}: ${message}`);
    return;
  }
  const env = smsEnv();
  const base = env.AT_USERNAME === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
  const form = new URLSearchParams({ username: env.AT_USERNAME, to: toE164, message });
  if (env.AT_SENDER_ID) form.set("from", env.AT_SENDER_ID);
  const res = await fetch(`${base}/version1/messaging`, {
    method: "POST",
    headers: { apiKey: env.AT_API_KEY, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`SMS send failed (${res.status})`);
  const body = (await res.json()) as { SMSMessageData?: { Recipients?: { status: string; statusCode: number }[] } };
  const r = body.SMSMessageData?.Recipients?.[0];
  if (!r || r.statusCode >= 400) throw new Error(`SMS rejected: ${r?.status ?? "no recipient"}`);
}

export const formatKampalaTime = (d: Date) =>
  new Intl.DateTimeFormat("en-UG", { timeZone: "Africa/Kampala", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
