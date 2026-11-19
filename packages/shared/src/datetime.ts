/** Manual Africa/Kampala (UTC+3) formatting so output never depends on the device's Intl/timezone. */
import { kampalaDateOf } from "./slots";

const KAMPALA_MS = 3 * 3600_000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const local = (iso: string | Date) => new Date(new Date(iso).getTime() + KAMPALA_MS);

export function formatTime(iso: string | Date): string {
  const d = local(iso);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function formatDay(iso: string | Date): string {
  const d = local(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export const formatDateTime = (iso: string | Date) => `${formatDay(iso)}, ${formatTime(iso)}`;

/** Next `count` calendar dates (YYYY-MM-DD) in Kampala, starting today. */
export function upcomingDates(count: number): string[] {
  return Array.from({ length: count }, (_, i) => kampalaDateOf(new Date(Date.now() + i * 86_400_000)));
}

export const dateLabel = (ymd: string) => formatDay(`${ymd}T12:00:00+03:00`);

/** Shift a YYYY-MM-DD calendar date by whole days. */
export const addDays = (ymd: string, days: number) =>
  new Date(new Date(`${ymd}T12:00:00+03:00`).getTime() + days * 86_400_000 + KAMPALA_MS).toISOString().slice(0, 10);
