/**
 * GET /api/cron/smart-discount-check  (also accepts POST)
 *
 * Vercel Cron schedule: `0 7 * * *` (07:00 UTC = 12:30 Sri Lanka).
 *
 * Story 6.4: FR-25a — within 5 minutes of 12:30 PM Colombo, check each
 * confirmed CookPlanItem against the 30% sales threshold and emit a
 * smartDiscountAlert to /admin for any item below.
 *
 * Authenticated by `Authorization: Bearer <CRON_SECRET>` header
 * (Vercel sends this automatically; see `src/lib/cron-auth.ts`).
 *
 * Vercel Cron invokes endpoints with HTTP GET, so we export GET as
 * the primary handler. POST is preserved as an alias for ad-hoc
 * curl-based testing and any pre-existing callers.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitSmartDiscountAlert } from "@/lib/order-events";
import { getTodayDate } from "@/lib/date-utils";
import { assertCronSecret } from "@/lib/cron-auth";

async function handle(req: NextRequest) {
  const guard = assertCronSecret(req);
  if (guard) return guard;

  console.log("[cron/smart-discount-check] start");
  try {
    // Use Colombo-today (not UTC today) — the canteen's "today" is
    // Sri Lanka today, which is what the cook plan is keyed to.
    const today = getTodayDate();
    const todayStart = new Date(today);

    // Confirmed cook plan items for today
    const confirmedPlans = await prisma.cookPlanItem.findMany({
      where: { date: todayStart, status: "CONFIRMED" },
      include: {
        menuItem: { include: { dailySpecials: { where: { date: todayStart } } } },
      },
    });

    // Units sold per item for today (Colombo day boundary)
    const todayEnd = new Date(today);
    todayEnd.setUTCHours(23, 59, 59, 999);
    const unitsSoldToday = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: { order: { createdAt: { gte: todayStart, lte: todayEnd } } },
      _sum: { quantity: true },
    });
    const soldMap = new Map<string, number>();
    for (const row of unitsSoldToday) {
      soldMap.set(row.menuItemId, row._sum.quantity ?? 0);
    }

    let alertsEmitted = 0;
    for (const plan of confirmedPlans) {
      if (plan.finalQty <= 0) continue;
      const unitsSold = soldMap.get(plan.menuItemId) ?? 0;
      const percentSold = (unitsSold / plan.finalQty) * 100;
      if (percentSold >= 30) continue; // on track

      const dailySpecial = plan.menuItem.dailySpecials[0];
      const currentPrice = dailySpecial
        ? Number(dailySpecial.specialPrice)
        : Number(plan.menuItem.basePrice);

      emitSmartDiscountAlert({
        menuItemId: plan.menuItemId,
        name: plan.menuItem.name,
        cookPlanTarget: plan.finalQty,
        unitsSold,
        percentSold: Math.round(percentSold * 10) / 10,
        currentPrice,
        checkedAt: new Date().toISOString(),
      });
      alertsEmitted++;
    }

    console.log(
      `[cron/smart-discount-check] done — ${alertsEmitted} alert(s) emitted for ${confirmedPlans.length} confirmed items`
    );
    return NextResponse.json({ ok: true, alertsEmitted, itemsChecked: confirmedPlans.length });
  } catch (err) {
    console.error("[cron/smart-discount-check] failed:", err);
    return NextResponse.json(
      { ok: false, error: "smart-discount check failed" },
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
