/** Uganda is UTC+3 year-round (no DST), so shifts stored as local "HH:MM" convert with a fixed offset. */
export const KAMPALA_OFFSET = "+03:00";
const OFFSET_MS = 3 * 60 * 60 * 1000;

export interface TimeRange { start: Date; end: Date }
export interface ShiftWindow { startTime: string; endTime: string } // "HH:MM" or "HH:MM:SS"

export interface SlotQuery {
  /** Calendar date in Africa/Kampala, YYYY-MM-DD. */
  date: string;
  shifts: ShiftWindow[];
  durationMin: number;
  busy: TimeRange[];
  now: Date;
  stepMin?: number;
  minLeadMin?: number;
}

export const kampalaInstant = (date: string, time: string) => new Date(`${date}T${time.slice(0, 5)}:00${KAMPALA_OFFSET}`);
export const kampalaDateOf = (instant: Date) => new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
/** 0 = Sunday, matching staff_shifts.weekday. */
export const kampalaWeekday = (date: string) => new Date(`${date}T12:00:00${KAMPALA_OFFSET}`).getUTCDay();

/** All bookable start times for one staff member on one day. */
export function computeSlots(q: SlotQuery): Date[] {
  const step = (q.stepMin ?? 15) * 60_000;
  const duration = q.durationMin * 60_000;
  const earliest = q.now.getTime() + (q.minLeadMin ?? 30) * 60_000;
  const slots: Date[] = [];
  for (const shift of q.shifts) {
    const shiftStart = kampalaInstant(q.date, shift.startTime).getTime();
    const shiftEnd = kampalaInstant(q.date, shift.endTime).getTime();
    for (let t = shiftStart; t + duration <= shiftEnd; t += step) {
      if (t < earliest) continue;
      const end = t + duration;
      if (q.busy.some((b) => t < b.end.getTime() && end > b.start.getTime())) continue;
      slots.push(new Date(t));
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** Same rules as computeSlots, so booking validation can never disagree with what the client was shown. */
export function isSlotBookable(q: Omit<SlotQuery, "date">, startsAt: Date): boolean {
  const date = kampalaDateOf(startsAt);
  return computeSlots({ ...q, date }).some((s) => s.getTime() === startsAt.getTime());
}
