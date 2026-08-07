import { verifyApiAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/student/cart/apply-flash-deal
 * Validate that a Flash Deal is still active and the student hasn't
 * already ordered the item today. Returns the discounted price.
 * Body: { menuItemId, flashDealId }
 * Story 6.4: Smart Discount Trigger & Flash Deals (FR-25)
 */
export async function POST(req: NextRequest) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const userId = session.user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { menuItemId, flashDealId } = body;

    if (!menuItemId || !flashDealId) {
      return NextResponse.json(
        { error: "menuItemId and flashDealId are required" },
        { status: 400 }
      );
    }

    // ── Validate Flash Deal is active ───────────────────────────
    const deal = await prisma.flashDeal.findUnique({
      where: { id: flashDealId },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "Flash Deal not found" },
        { status: 404 }
      );
    }

    if (deal.menuItemId !== menuItemId) {
      return NextResponse.json(
        { error: "Flash Deal does not match the menu item" },
        { status: 400 }
      );
    }

    if (deal.cancelledAt || deal.expiresAt <= new Date()) {
      return NextResponse.json(
        { error: "Flash Deal is no longer active" },
        { status: 410 }
      );
    }

    // ── Check student hasn't already ordered this item today ────
    const alreadyOrdered = await prisma.orderItem.findFirst({
      where: {
        menuItemId,
        order: {
          studentId: userId,
          createdAt: { gte: today },
        },
      },
    });

    if (alreadyOrdered) {
      return NextResponse.json(
        { error: "You have already ordered this item today" },
        { status: 409 }
      );
    }

    // ── Get menu item price ─────────────────────────────────────
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        dailySpecials: { where: { date: today } },
      },
    });

    if (!menuItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    const dailySpecial = menuItem.dailySpecials[0];
    const originalPrice = dailySpecial
      ? Number(dailySpecial.specialPrice)
      : Number(menuItem.basePrice);

    const discountedPrice =
      Math.round(originalPrice * (1 - deal.discountPercent / 100) * 100) / 100;

    return NextResponse.json({
      menuItemId,
      flashDealId: deal.id,
      discountPercent: deal.discountPercent,
      originalPrice,
      discountedPrice,
      expiresAt: deal.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[apply-flash-deal] POST failed:", err);
    return NextResponse.json(
      { error: "Failed to apply flash deal" },
      { status: 500 }
    );
  }
}
