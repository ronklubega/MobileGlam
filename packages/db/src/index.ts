import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };

/** Server-side only: connects with the service credentials and bypasses RLS. Never import in client bundles. */
export function createDb(databaseUrl: string) {
  return drizzle(postgres(databaseUrl, { max: 10, prepare: false }), { schema });
}
export type Db = ReturnType<typeof createDb>;
