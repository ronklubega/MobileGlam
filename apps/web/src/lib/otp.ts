import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const generateOtp = () => String(randomInt(100_000, 1_000_000));

/** Keyed hash bound to the request id, so a leaked table can't be reversed without the server secret. */
export const hashOtp = (secret: string, requestId: string, code: string) =>
  createHmac("sha256", secret).update(`${requestId}:${code}`).digest("hex");

export function verifyOtp(secret: string, requestId: string, code: string, expectedHash: string): boolean {
  const given = Buffer.from(hashOtp(secret, requestId, code));
  const want = Buffer.from(expectedHash);
  return given.length === want.length && timingSafeEqual(given, want);
}

/** +256772123456 -> +25677••••456 */
export const maskPhone = (e164: string) => `${e164.slice(0, 6)}••••${e164.slice(-3)}`;
