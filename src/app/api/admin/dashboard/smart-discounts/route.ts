import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/dashboard/smart-discounts
 * Returns menu items where today's sales < 30% of confirmed Cook Plan target.
 * Excludes items that already have an active (non-expired, non-cancelled) Flash Deal.
 * Story 6.4: Smart Discount Trigger (FR-25)
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // ── Find all confirmed CookPlanItems for today ──────────────
    const confirmedPlans = await prisma.cookPlanItem.findMany({
      where: { date: today, status: "CONFIRMED" },
      include: {
        menuItem: {
          include: { dailySpecials: { where: { date: today } } },
        },
      },
    });

    // ── Get today's units sold per menu item ────────────────────
    const unitsSoldToday = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        order: { createdAt: { gte: today } },
      },
      _sum: { quantity: true },
    });
    const soldMap = new Map(
      unitsSoldToday.map((r) => [r.menuItemId, r._sum.quantity ?? 0])
    );

    // ── Get active FlashDeals for today to exclude from alerts ───
    const now = new Date();
    const activeDeals = await prisma.flashDeal.findMany({
      where: {
        expiresAt: { gt: now },
        cancelledAt: null,
      },
      select: { menuItemId: true },
    });
    const activeDealItemIds = new Set(activeDeals.map((d) => d.menuItemId));

    // ── Build alert list: items with sales < 30% of target ──────
    const alerts = confirmedPlans
      .filter((plan) => plan.finalQty > 0)
      .map((plan) => {
        const unitsSold = soldMap.get(plan.menuItemId) ?? 0;
        const percentSold = (unitsSold / plan.finalQty) * 100;
        const dailySpecial = plan.menuItem.dailySpecials[0];
        const currentPrice = dailySpecial
          ? Number(dailySpecial.specialPrice)
          : Number(plan.menuItem.basePrice);

        return {
          menuItemId: plan.menuItemId,
          name: plan.menuItem.name,
          dietaryType: plan.menuItem.dietaryType,
          imageUrl: plan.menuItem.imageUrl,
          cookPlanTarget: plan.finalQty,
          unitsSold,
          percentSold: Math.round(percentSold * 10) / 10,
          currentPrice,
        };
      })
      .filter(
        (a) =>
          a.percentSold < 30 &&
          !activeDealItemIds.has(a.menuItemId) &&
          a.cookPlanTarget > 0
      )
      .sort((a, b) => a.percentSold - b.percentSold);

    return NextResponse.json({
      alerts,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[smart-discounts] query failed:", err);
    return NextResponse.json(
      { error: "Failed to check smart discounts" },
      { status: 500 }
    );
  }
}
