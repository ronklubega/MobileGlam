import { z } from "zod";

const core = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  DATABASE_URL: z.string().min(10),
  APP_BASE_URL: z.string().url(),
  CRON_SECRET: z.string().min(16),
});

const mtn = z.object({
  MTN_MOMO_BASE_URL: z.string().url(),
  MTN_MOMO_TARGET_ENV: z.string().min(1), // "sandbox" | "mtnuganda"
  MTN_MOMO_SUBSCRIPTION_KEY: z.string().min(1),
  MTN_MOMO_API_USER: z.string().min(1),
  MTN_MOMO_API_KEY: z.string().min(1),
  MTN_MOMO_CALLBACK_SECRET: z.string().min(16),
});

const airtel = z.object({
  AIRTEL_BASE_URL: z.string().url(),
  AIRTEL_CLIENT_ID: z.string().min(1),
  AIRTEL_CLIENT_SECRET: z.string().min(1),
  AIRTEL_COUNTRY: z.string().default("UG"),
  AIRTEL_CURRENCY: z.string().default("UGX"),
  AIRTEL_CALLBACK_SECRET: z.string().min(16),
});

const sms = z.object({
  AT_USERNAME: z.string().min(1),
  AT_API_KEY: z.string().min(1),
  AT_SENDER_ID: z.string().optional(),
});

const smsHook = z.object({
  // From Supabase -> Authentication -> Hooks -> Send SMS. Looks like "v1,whsec_<base64>".
  SEND_SMS_HOOK_SECRET: z.string().regex(/^v1,whsec_/, 'Must look like "v1,whsec_..."'),
});

/** Each group is validated on first use so a missing Airtel key doesn't break MTN (or the build). */
function lazy<T extends z.ZodTypeAny>(schema: T, label: string) {
  let cached: z.infer<T> | undefined;
  return (): z.infer<T> => {
    if (cached) return cached;
    const r = schema.safeParse(process.env);
    if (!r.success) {
      const missing = r.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid ${label} environment: ${missing}`);
    }
    return (cached = r.data);
  };
}

export const coreEnv = lazy(core, "core");
export const mtnEnv = lazy(mtn, "MTN MoMo");
export const airtelEnv = lazy(airtel, "Airtel Money");
export const smsEnv = lazy(sms, "SMS");
export const smsHookEnv = lazy(smsHook, "Send SMS hook");
