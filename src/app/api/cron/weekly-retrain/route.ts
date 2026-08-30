/**
 * POST /api/cron/weekly-retrain
 *
 * Vercel Cron schedule: `30 20 * * 6` (Sat 20:30 UTC = Sun 02:00 Sri Lanka).
 *
 * Story 7.6: weekly ML model retraining pipeline.
 *
 * Authenticated by `x-cron-secret` header (see `src/lib/cron-auth.ts`).
 *
 * NOTE: This job may exceed the Vercel Hobby plan's 10s function
 * timeout. On the Pro plan, the `maxDuration` can be raised to 300s
 * in vercel.json. If the timeout becomes a problem, split the work:
 * 1. Endpoint A (instant): schedules a background job and returns 200.
 * 2. Background job: does the actual retraining via a separate
 *    invocation pattern (e.g., a Railway cron or GitHub Action).
 */
import { NextRequest, NextResponse } from "next/server";
import { runWeeklyRetraining } from "@/lib/retrain-runner";
import { assertCronSecret } from "@/lib/cron-auth";

export async function POST(req: NextRequest) {
  const guard = assertCronSecret(req);
  if (guard) return guard;

  console.log("[cron/weekly-retrain] start");
  try {
    const result = await runWeeklyRetraining();
    console.log(
      `[cron/weekly-retrain] done — ${result.trained} trained, ${result.rolledBack} rolled back, ${result.skipped} skipped`
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/weekly-retrain] failed:", err);
    return NextResponse.json(
      { ok: false, error: "retrain failed" },
      { status: 500 }
    );
  }
}
