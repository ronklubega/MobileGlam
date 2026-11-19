import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Uptime probe: confirms the app is up AND can reach Postgres. Reveals nothing about configuration. */
export async function GET() {
  try {
    await db().execute(sql`select 1`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[health] database check failed", e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
