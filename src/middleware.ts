import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// First gate for pages (fast redirects); every query is ALSO protected by RLS, and server actions re-check the role.
// It also keeps the login fresh: getUser() refreshes an expiring session and the new cookies are written to the response.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user }, error: authErr } = await sb.auth.getUser();   // verifies the JWT with Supabase, not just the cookie
  const path = req.nextUrl.pathname;

  // Redirects must carry any refreshed session cookies too. Otherwise the browser keeps a refresh token that
  // Supabase has already replaced, and the very next click signs the user out.
  const go = (to: string) => {
    const r = NextResponse.redirect(new URL(to, req.url));
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  // API routes (QR, scan, reports): only refresh the session here. Each route checks the user and role itself and
  // answers 401/403, so a fetch() never gets redirected to an HTML sign-in page.
  if (path.startsWith("/api")) return res;

  // A network hiccup or Supabase outage is not "signed out": let the request through (pages and RLS still re-check).
  const flaky = authErr?.name === "AuthRetryableFetchError" || (authErr?.status ?? 0) >= 500;
  if (!user) return flaky ? res : go("/signin");

  const { data: me, error: meErr } = await sb.from("profiles").select("role, profile_complete").eq("id", user.id).single();
  // PGRST116 = no such profile row. Any other error is a temporary failure, not a reason to sign the user out.
  if (!me) return meErr && meErr.code !== "PGRST116" ? res : go("/signin");

  const home = me.role === "admin" ? "/admin/dashboard" : "/employee/home";
  if (path.startsWith("/admin") && me.role !== "admin") return go(home);
  if (path.startsWith("/employee") && me.role !== "employee") return go(home);
  // first sign-in: nothing but the setup page is reachable until the profile is complete
  if (me.role === "employee" && !me.profile_complete && path !== "/employee/setup") return go("/employee/setup");
  if (me.role === "employee" && me.profile_complete && path === "/employee/setup") return go(home);
  return res;
}
export const config = { matcher: ["/admin/:path*", "/employee/:path*", "/api/:path*"] };