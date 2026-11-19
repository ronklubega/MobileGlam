import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { computeSlots, kampalaInstant, kampalaWeekday, type TimeRange } from "@mobileglam/shared";
import { schema } from "@mobileglam/db";
import { errors } from "@/lib/http";
import { db } from "../db";

const { services, staff, staffServices, staffShifts } = schema;

export async function loadShifts(staffId: string, date: string) {
  return db()
    .select({ startTime: staffShifts.startTime, endTime: staffShifts.endTime })
    .from(staffShifts)
    .where(and(eq(staffShifts.staffId, staffId), eq(staffShifts.weekday, kampalaWeekday(date))));
}

/** Busy ranges (active bookings + time off) via the SECURITY DEFINER function from migration 0002. */
export async function loadBusy(staffId: string, from: Date, to: Date): Promise<TimeRange[]> {
  const rows = await db().execute<{ starts_at: string | Date; ends_at: string | Date }>(
    sql`select starts_at, ends_at from get_busy_ranges(${staffId}::uuid, ${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz)`,
  );
  return Array.from(rows, (r) => ({ start: new Date(r.starts_at), end: new Date(r.ends_at) }));
}

export async function getBookableContext(serviceId: string, staffId: string) {
  const [row] = await db()
    .select({ service: services, staff })
    .from(services)
    .innerJoin(staffServices, eq(staffServices.serviceId, services.id))
    .innerJoin(staff, and(eq(staff.id, staffServices.staffId), eq(staff.tenantId, services.tenantId)))
    .where(and(eq(services.id, serviceId), eq(staff.id, staffId), eq(services.isActive, true), eq(staff.isActive, true)));
  if (!row) throw errors.notFound("Service or staff member");
  return row;
}

export async function listSlots(input: { staffId: string; serviceId: string; date: string }): Promise<string[]> {
  const { service } = await getBookableContext(input.serviceId, input.staffId);
  const dayStart = kampalaInstant(input.date, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const [shifts, busy] = await Promise.all([loadShifts(input.staffId, input.date), loadBusy(input.staffId, dayStart, dayEnd)]);
  return computeSlots({ date: input.date, shifts, durationMin: service.durationMinutes, busy, now: new Date() }).map((d) => d.toISOString());
}
