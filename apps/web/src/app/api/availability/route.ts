import { availabilityQuerySchema } from "@glamdesk/shared";
import { handle, parseQuery } from "@/lib/http";
import { listSlots } from "@/server/services/availability.service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const q = parseQuery(req, availabilityQuerySchema);
  return { date: q.date, timezone: "Africa/Kampala", slots: await listSlots(q) };
});
