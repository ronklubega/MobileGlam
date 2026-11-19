import { z } from "zod";

export type UgNetwork = "mtn" | "airtel" | "africell" | "lycamobile" | "utel";

/** Ugandan mobile prefixes (first two digits of the 9-digit national number). */
const PREFIX_TO_NETWORK: Record<string, UgNetwork> = {
  "76": "mtn",
  "77": "mtn",
  "78": "mtn",
  "70": "airtel",
  "74": "airtel",
  "75": "airtel",
  "79": "africell",
  "72": "lycamobile",
  "71": "utel",
};

/**
 * Normalises 0771234567 / 771234567 / 256771234567 / +256 771 234 567
 * to E.164 (+256771234567). Returns null when not a valid Ugandan mobile.
 */
export function normalizeUgPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  let national: string;
  if (digits.startsWith("256")) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;
  if (!/^\d{9}$/.test(national)) return null;
  if (!PREFIX_TO_NETWORK[national.slice(0, 2)]) return null;
  return `+256${national}`;
}

export function detectUgNetwork(e164: string): UgNetwork | null {
  const normalized = normalizeUgPhone(e164);
  return normalized ? (PREFIX_TO_NETWORK[normalized.slice(4, 6)] ?? null) : null;
}

/** MSISDN without '+', as MTN MoMo expects (256771234567). */
export const toMsisdn = (e164: string) => e164.replace(/^\+/, "");

/** National number without country code, as Airtel expects (771234567). */
export const toNationalNumber = (e164: string) => e164.replace(/^\+256/, "");

export const ugPhoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeUgPhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Ugandan mobile number (e.g. 0772 123 456)" });
      return z.NEVER;
    }
    return n;
  });
