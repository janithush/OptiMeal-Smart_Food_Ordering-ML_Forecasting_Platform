import { verifyApiAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/student/flash-deals
 * Returns active Flash Deals for the current Student.
 * Filters out items the Student has already ordered today (FR-25b).
 * Story 6.4: Smart Discount Trigger & Flash Deals (FR-25)
 */
export async function GET() {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const userId = session.user.id;
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // ── Find all active Flash Deals ─────────────────────────────
    const deals = await prisma.flashDeal.findMany({
      where: {
        expiresAt: { gt: now },
        cancelledAt: null,
      },
      include: {
        menuItem: {
          include: { dailySpecials: { where: { date: today } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (deals.length === 0) {
      return NextResponse.json({ deals: [] });
    }

    // ── Find items this student has already ordered today ───────
    const orderedItemIds = await prisma.orderItem.findMany({
      where: {
        menuItemId: { in: deals.map((d) => d.menuItemId) },
        order: {
          studentId: userId,
          createdAt: { gte: today },
        },
      },
      select: { menuItemId: true },
      distinct: ["menuItemId"],
    });
    const alreadyOrdered = new Set(orderedItemIds.map((r) => r.menuItemId));

    // ── Filter deals: only show items student hasn't ordered ────
    const result = deals
      .filter((d) => !alreadyOrdered.has(d.menuItemId))
      .map((d) => {
        const dailySpecial = d.menuItem.dailySpecials[0];
        const effectivePrice = dailySpecial
          ? Number(dailySpecial.specialPrice)
          : Number(d.menuItem.basePrice);
        const discountedPrice =
          Math.round(effectivePrice * (1 - d.discountPercent / 100) * 100) / 100;

        return {
          id: d.id,
          menuItemId: d.menuItemId,
          menuItemName: d.menuItem.name,
          dietaryType: d.menuItem.dietaryType,
          imageUrl: d.menuItem.imageUrl,
          basePrice: effectivePrice,
          discountPercent: d.discountPercent,
          discountedPrice,
          message: d.message,
          expiresAt: d.expiresAt.toISOString(),
        };
      });

    return NextResponse.json({ deals: result });
  } catch (err) {
    console.error("[student-flash-deals] GET failed:", err);
    return NextResponse.json(
      { error: "Failed to get flash deals" },
      { status: 500 }
    );
  }
}
