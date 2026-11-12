// The auth gate. Everything except the landing page, the login page, the
// login/logout endpoints, and static assets requires a valid signed session
// cookie: unauthenticated page requests redirect to /login, unauthenticated
// API requests get a 401 (never a redirect — the BFF routes hold the agent
// bearer token, so they must not be reachable without a session).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/", "/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/api/auth/");
  const isApi = pathname.startsWith("/api/");

  if (isAuthRoute) return NextResponse.next();

  const authenticated = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET ?? ""
  );

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (PUBLIC_PATHS.includes(pathname) || authenticated) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in required." } }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
