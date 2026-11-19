import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the Supabase session cookie and gates /dashboard. API routes use Bearer tokens and are not matched. */
export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return new NextResponse("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local", { status: 500 });

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  // getClaims verifies the JWT locally (no network round trip) and still refreshes expired sessions.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;
  const path = req.nextUrl.pathname;

  // Admin accounts created with a one-time password must replace it before using anything else.
  const forcedReset = (user?.user_metadata as { must_change_password?: boolean } | undefined)?.must_change_password === true;
  if (user && forcedReset && path.startsWith("/dashboard") && path !== "/dashboard/account") {
    return NextResponse.redirect(new URL("/dashboard/account?required=1", req.url));
  }
  const protectedPath = path.startsWith("/dashboard") || path.startsWith("/onboarding");
  if (!user && protectedPath) return NextResponse.redirect(new URL("/login", req.url));
  if (user && (path === "/login" || path === "/register")) return NextResponse.redirect(new URL("/dashboard", req.url));
  return res;
}

export const config = { matcher: ["/dashboard/:path*", "/onboarding/:path*", "/login", "/register"] };
