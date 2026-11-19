import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const supabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local");
  return { url, anon };
};

/** Cookie-session Supabase client acting AS the signed-in user, so Row-Level Security applies to every query. */
export async function supabaseServer() {
  const { url, anon } = supabaseConfig();
  const store = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* called from a Server Component; middleware refreshes the session instead */
        }
      },
    },
  });
}
