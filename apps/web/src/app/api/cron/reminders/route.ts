import { coreEnv } from "@/lib/env";
import { errors, handle, safeEqual } from "@/lib/http";
import { reconcileOpenPayments } from "@/server/services/booking.service";
import { sendDueReminders } from "@/server/services/reminder.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Trigger every 5 minutes (Vercel Cron / pg_net / any scheduler) with `Authorization: Bearer $CRON_SECRET`. */
export const GET = handle(async (req) => {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!safeEqual(token, coreEnv().CRON_SECRET)) throw errors.unauthorized();
  const [reminders, payments] = await Promise.all([sendDueReminders(), reconcileOpenPayments()]);
  return { reminders, payments };
});
