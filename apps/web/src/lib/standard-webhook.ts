import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookParts {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  /** "v1,whsec_<base64>" as shown in the Supabase dashboard. */
  secret: string;
  now?: number;
  toleranceSeconds?: number;
}

/**
 * Verifies a Standard Webhooks signature (what Supabase Auth Hooks use):
 * HMAC-SHA256 over `${id}.${timestamp}.${body}` keyed with the base64-decoded secret.
 * Rejects stale timestamps to stop replays. The header may carry several space-separated `v1,<sig>` values.
 */
export function verifyStandardWebhook({ id, timestamp, signature, body, secret, now = Date.now(), toleranceSeconds = 300 }: WebhookParts): boolean {
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(now / 1000 - ts) > toleranceSeconds) return false;

  const key = Buffer.from(secret.replace(/^v1,whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
