import { requireApiRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { runWeeklyRetraining } from "@/lib/retrain-runner";

/**
 * POST /api/admin/forecasts/retrain — Manually trigger weekly ML model retraining.
 * Admin-only. Runs the full retraining pipeline (gather → call ML → save logs → emit alerts).
 */
export async function POST() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  try {
    const result = await runWeeklyRetraining();
    return NextResponse.json({
      success: true,
      summary: {
        totalItems: result.totalItems,
        trained: result.trained,
        rolledBack: result.rolledBack,
        skipped: result.skipped,
      },
    });
  } catch (err) {
    console.error("[forecasts/retrain] Manual retrain failed:", err);
    return NextResponse.json(
      { success: false, error: "Retrain run failed" },
      { status: 500 }
    );
  }
}
