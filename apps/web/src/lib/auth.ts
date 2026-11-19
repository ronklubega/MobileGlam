import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { coreEnv } from "./env";
import { errors } from "./http";

// No generated DB types yet, so the schema generic is left open.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let admin: SupabaseClient<any, "public", any> | undefined;
/** Service-role client. Server only; bypasses RLS, so every query must scope by the authenticated user. */
export function supabaseAdmin() {
  const env = coreEnv();
  return (admin ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

export interface AuthUser { id: string }

/** Verifies the Supabase access token sent by the mobile app (Authorization: Bearer <jwt>). */
export async function requireUser(req: NextRequest): Promise<AuthUser> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) throw errors.unauthorized();
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) throw errors.unauthorized();
  return { id: data.user.id };
}
