/**
 * GET /api/cron/post-cutoff-cook-plan  (also accepts POST)
 *
 * Vercel Cron schedule: `35 3 * * *` (03:35 UTC = 09:05 Sri Lanka).
 *
 * Story 7.4: counts confirmed pre-orders for today and updates each
 * CookPlanItem to `finalQty = max(forecastQty, preOrderQty * 1.10)`.
 *
 * Authenticated by `Authorization: Bearer <CRON_SECRET>` header
 * (Vercel sends this automatically; see `src/lib/cron-auth.ts`).
 *
 * Vercel Cron invokes endpoints with HTTP GET, so we export GET as
 * the primary handler. POST is preserved as an alias for ad-hoc
 * curl-based testing and any pre-existing callers.
 */
import { NextRequest, NextResponse } from "next/server";
import { runPostCutoffUpdate } from "@/lib/cook-plan";
import { getIO } from "@/lib/socket-server";
import { assertCronSecret } from "@/lib/cron-auth";

async function handle(req: NextRequest) {
  const guard = assertCronSecret(req);
  if (guard) return guard;

  console.log("[cron/post-cutoff-cook-plan] start");
  try {
    const result = await runPostCutoffUpdate();
    console.log(
      `[cron/post-cutoff-cook-plan] done — ${result.itemsUpdated} items updated`
    );

    // Emit cookPlanReady event (admin dashboard will refresh).
    // Best-effort: if socket.io isn't initialised (e.g. serverless cold
    // start), the next dashboard poll will still pick up the data.
    try {
      const io = getIO();
      const today = new Date().toISOString().slice(0, 10);
      io.of("/admin").emit("cookPlanReady", {
        date: today,
        itemCount: result.itemsUpdated,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // ignore — no socket layer in this execution context
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/post-cutoff-cook-plan] failed:", err);
    return NextResponse.json(
      { ok: false, error: "post-cutoff update failed" },
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
