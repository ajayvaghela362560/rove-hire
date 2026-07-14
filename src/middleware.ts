import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/constants";

/**
 * UX-only guard: bounce obviously-signed-out users away from HR pages before a
 * server round-trip. This is NOT the security boundary — every page/action/route
 * independently calls requireSession() against the DB. Middleware must never be
 * the sole gate (CVE-2025-29927 x-middleware-subrequest bypass).
 */
const PUBLIC_PREFIXES = ["/login", "/apply", "/api"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Exclude Next's internals and public metadata files (favicon, icons, robots,
  // sitemap). Without excluding robots.txt/sitemap.xml the auth redirect below
  // would bounce crawlers to /login and they'd never see the Disallow rules.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
