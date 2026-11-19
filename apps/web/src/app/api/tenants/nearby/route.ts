import { sql } from "drizzle-orm";
import { nearbySearchSchema } from "@glamdesk/shared";
import { handle, parseQuery } from "@/lib/http";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const q = parseQuery(req, nearbySearchSchema);
  const rows = await db().execute(
    sql`select * from nearby_tenants(${q.lat}::float8, ${q.lng}::float8, ${q.radiusKm}::float8, ${q.type ?? null}::tenant_type, ${q.homeVisit ?? null}::boolean)`,
  );
  return { results: Array.from(rows) };
});
