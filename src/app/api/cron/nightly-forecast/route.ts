/**
 * POST /api/cron/nightly-forecast
 *
 * Vercel Cron schedule: `0 12 * * *` (12:00 UTC = 17:30 Sri Lanka).
 *
 * Story 7.3: nightly demand forecast generation. Runs at 17:30 Colombo
 * time so that 18:00 service-prep cooks can review the forecast
 * before the kitchen starts preparing for tomorrow's lunch.
 *
 * (Was originally 18:00 in `server.ts`, which used the local server's
 * UTC clock. We've moved the actual cook prep earlier in the day
 * by 30 minutes; the deadline for topping up the menu is now 17:30.)
 *
 * Authenticated by `x-cron-secret` header (see `src/lib/cron-auth.ts`).
 */
import { NextRequest, NextResponse } from "next/server";
import { runNightlyForecast } from "@/lib/forecast-runner";
import { assertCronSecret } from "@/lib/cron-auth";

export async function POST(req: NextRequest) {
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
