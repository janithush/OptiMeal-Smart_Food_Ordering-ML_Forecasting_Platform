import { requireApiRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { runNightlyForecast } from "@/lib/forecast-runner";

/**
 * POST /api/admin/forecasts/trigger
 *
 * Manually trigger a nightly forecast run.
 * Admin-only. Useful for testing and re-running if the cron failed.
 */
export async function POST() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  try {
    const result = await runNightlyForecast();
    return NextResponse.json({
      success: true,
      forecastsGenerated: result.forecastsGenerated,
      highTrafficFlag: result.highTraffic,
      fallbackUsed: result.fallbackUsed,
    });
  } catch (err) {
    console.error("[forecasts/trigger] Manual trigger failed:", err);
    return NextResponse.json(
      { success: false, error: "Forecast run failed" },
      { status: 500 }
    );
  }
}
