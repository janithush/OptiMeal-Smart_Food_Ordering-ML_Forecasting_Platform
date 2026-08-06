import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Next.js Edge Middleware — RBAC Route Protection (AD-4)
 *
 * Runs on every matched request BEFORE the Route Handler or page renders.
 * Reads the JWT session from the cookie to determine the user's role.
 * This is the FIRST layer of protection — fast, stateless, no database calls.
 *
 * SECOND layer: Route Handlers and pages call auth() again for authoritative
 * server-side verification (can access Prisma/DB).
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // ── Public routes — allow through ──────────────────────────────
  if (
    pathname === "/login" ||
    pathname === "/forbidden" ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // ── Unauthenticated — redirect to login with callbackUrl ───────
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role;

  // ── Student attempting to access admin routes ──────────────────
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (role !== "ADMIN") {
      // For page requests: redirect to /forbidden
      if (!pathname.startsWith("/api")) {
        return NextResponse.redirect(new URL("/forbidden", req.url));
      }
      // For API requests: return 403 JSON
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ── Admin attempting to access student routes ──────────────────
  if (pathname.startsWith("/student") || pathname.startsWith("/api/student")) {
    if (role !== "STUDENT") {
      if (!pathname.startsWith("/api")) {
        return NextResponse.redirect(new URL("/forbidden", req.url));
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
});

/**
 * Only match protected routes. Public routes (login, api/auth, static assets,
 * root "/") pass through middleware automatically without being evaluated.
 */
export const config = {
  matcher: [
    "/student/:path*",
    "/admin/:path*",
    "/api/student/:path*",
    "/api/admin/:path*",
  ],
};
