/**
 * cron-auth.ts — shared authorization for Vercel Cron endpoints.
 *
 * Vercel Cron Jobs are public HTTP endpoints (they're deployed at a
 * predictable URL). To prevent external callers from triggering our
 * schedulers, every cron route verifies a shared-secret header
 * (`x-cron-secret`) against the `CRON_SECRET` env var.
 *
 * In production, `CRON_SECRET` is set in the Vercel project env vars.
 * For local dev, set it in `.env.local` (gitignored).
 *
 * Vercel sends the value in the `Authorization: Bearer <secret>` header
 * on every cron invocation.
 */
import { NextRequest, NextResponse } from "next/server";

/**
 * Returns a 401 NextResponse if the request is not from Vercel Cron.
 * Returns null when the request is authorized and the route should proceed.
 *
 * Usage:
 *   const guard = assertCronSecret(req);
 *   if (guard) return guard;
 */
export function assertCronSecret(req: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error(
      "[cron-auth] CRON_SECRET is not set — refusing all cron requests"
    );
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  // Vercel sends `Authorization: Bearer <CRON_SECRET>` on every cron call.
  // We also accept `x-cron-secret` for manual curl-based testing.
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  const headerSecret = bearer ?? req.headers.get("x-cron-secret");

  if (!headerSecret || !constantTimeEquals(headerSecret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Constant-time string comparison. Avoids leaking length or content
 * of the expected secret through timing differences.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
