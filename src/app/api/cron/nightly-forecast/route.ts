/**
 * GET /api/cron/nightly-forecast  (also accepts POST)
 *
 * Vercel Cron schedule: `30 12 * * *` (12:30 UTC = 18:00 Sri Lanka).
 *
 * Story 7.3: nightly demand forecast generation. Runs at 18:00 Colombo
 * so the forecast for tomorrow is ready before evening service prep
 * begins.
 *
 * Authenticated by `Authorization: Bearer <CRON_SECRET>` header
 * (Vercel sends this automatically; see `src/lib/cron-auth.ts`).
 *
 * Vercel Cron invokes endpoints with HTTP GET, so we export GET as
 * the primary handler. POST is preserved as an alias for ad-hoc
 * curl-based testing and any pre-existing callers.
 */
import { NextRequest, NextResponse } from "next/server";
import { runNightlyForecast } from "@/lib/forecast-runner";
import { assertCronSecret } from "@/lib/cron-auth";

async function handle(req: NextRequest) {
  const guard = assertCronSecret(req);
  if (guard) return guard;

  console.log("[cron/nightly-forecast] start");
  try {
    const result = await runNightlyForecast();
    console.log(
      `[cron/nightly-forecast] done — ${result.forecastsGenerated} items, ` +
        `highTraffic=${result.highTraffic}, fallback=${result.fallbackUsed}`
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/nightly-forecast] failed:", err);
    return NextResponse.json(
      { ok: false, error: "forecast run failed" },
      { status: 500 }
    );
  }
}

// Vercel Cron uses GET — https://vercel.com/docs/cron-jobs
export async function GET(req: NextRequest) {
  return handle(req);
}

// POST preserved for ad-hoc curl-based testing and any pre-existing
// internal callers.
export async function POST(req: NextRequest) {
  return handle(req);
}
