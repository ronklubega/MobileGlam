import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { schema } from "@mobileglam/db";
import { db } from "../db";
import { formatKampalaTime, sendSms } from "../notifications/sms";

const { bookings, profiles, services, staff, tenants } = schema;
const REMINDER_LEAD_MS = 2 * 3600_000;

/**
 * Sends the "your appointment is in 2 hours" SMS. Run every ~5 minutes. Each booking is claimed with a
 * conditional UPDATE before sending, so overlapping cron runs never double-text a client; a failed send
 * releases the claim so the next run retries (until the appointment starts).
 */
export async function sendDueReminders(now = new Date()) {
  const due = await db()
    .select({
      id: bookings.id, startsAt: bookings.startsAt, isHomeVisit: bookings.isHomeVisit,
      phone: profiles.phone, tenant: tenants.name, area: tenants.area, staff: staff.displayName, service: services.name,
    })
    .from(bookings)
    .innerJoin(profiles, eq(profiles.id, bookings.clientId))
    .innerJoin(tenants, eq(tenants.id, bookings.tenantId))
    .innerJoin(staff, eq(staff.id, bookings.staffId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .where(and(eq(bookings.status, "confirmed"), isNull(bookings.reminderSentAt), gt(bookings.startsAt, now), lte(bookings.startsAt, new Date(now.getTime() + REMINDER_LEAD_MS))))
    .limit(200);

  let sent = 0;
  let failed = 0;
  for (const b of due) {
    if (!b.phone) continue;
    const claim = await db()
      .update(bookings).set({ reminderSentAt: now })
      .where(and(eq(bookings.id, b.id), isNull(bookings.reminderSentAt)))
      .returning({ id: bookings.id });
    if (!claim.length) continue;
    try {
      const where = b.isHomeVisit ? "at your location" : `at ${b.tenant}${b.area ? `, ${b.area}` : ""}`;
      await sendSms(b.phone, `Reminder: ${b.service} with ${b.staff} ${where} at ${formatKampalaTime(b.startsAt)}. See you soon!`);
      sent++;
    } catch (e) {
      failed++;
      console.error("[reminders] send failed", b.id, e);
      await db().update(bookings).set({ reminderSentAt: null }).where(eq(bookings.id, b.id));
    }
  }
  return { due: due.length, sent, failed };
}
