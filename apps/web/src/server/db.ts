import { createDb, type Db } from "@glamdesk/db";
import { coreEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as { __db?: Db };

export function db(): Db {
  return (globalForDb.__db ??= createDb(coreEnv().DATABASE_URL));
}

/** Postgres error code lookup that survives driver/ORM wrapping. */
export function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code ?? err?.cause?.code;
}
export const EXCLUSION_VIOLATION = "23P01";
