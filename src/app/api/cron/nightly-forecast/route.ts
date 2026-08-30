/**
 * POST /api/cron/nightly-forecast
 *
 * Vercel Cron schedule: `30 12 * * *` (12:30 UTC = 18:00 Sri Lanka).
 *
 * Story 7.3: nightly demand forecast generation. Runs at 18:00 Colombo
 * so the forecast for tomorrow is ready before evening service prep
 * begins.
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
