import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  emitFlashDealPublished,
  emitFlashDealCancelled,
} from "@/lib/order-events";
import type { FlashDealPayload } from "@/lib/order-events";

/**
 * GET /api/admin/flash-deals
 * Returns all non-expired, non-cancelled Flash Deals for today
 * with live units-sold-since metrics.
 * Story 6.4: Smart Discount Trigger & Flash Deals (FR-25)
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
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

    // ── Compute live units-sold-since-deal-started for each deal ──
    const menuItemIds = deals.map((d) => d.menuItemId);
    const unitsSoldSinceDeal = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        menuItemId: { in: menuItemIds },
        order: { createdAt: { gte: today } },
      },
      _sum: { quantity: true },
    });
    const soldMap = new Map(
      unitsSoldSinceDeal.map((r) => [r.menuItemId, r._sum.quantity ?? 0])
    );

    const result = deals.map((d) => {
      const dailySpecial = d.menuItem.dailySpecials[0];
      const basePrice = Number(d.menuItem.basePrice);
      const effectivePrice = dailySpecial
        ? Number(dailySpecial.specialPrice)
        : basePrice;
      const discountedPrice = Math.round(
        effectivePrice * (1 - d.discountPercent / 100) * 100
      ) / 100;

      return {
        id: d.id,
        menuItemId: d.menuItemId,
        name: d.menuItem.name,
        dietaryType: d.menuItem.dietaryType,
        imageUrl: d.menuItem.imageUrl,
        basePrice: effectivePrice,
        discountPercent: d.discountPercent,
        discountedPrice,
        cookPlanTarget: d.cookPlanTarget,
        unitsSoldAtStart: d.unitsSoldAtStart,
        currentUnitsSold: soldMap.get(d.menuItemId) ?? 0,
        message: d.message,
        expiresAt: d.expiresAt.toISOString(),
        createdAt: d.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ deals: result });
  } catch (err) {
    console.error("[flash-deals] GET failed:", err);
    return NextResponse.json(
      { error: "Failed to list flash deals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/flash-deals
 * Creates a new Flash Deal and broadcasts to all connected /student sockets.
 * Body: { menuItemId, discountPercent, expiresAt, message? }
 * Story 6.4: Smart Discount Trigger & Flash Deals (FR-25)
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { menuItemId, discountPercent, expiresAt, message } = body;

    // ── Validation ──────────────────────────────────────────────
    if (!menuItemId || discountPercent == null || !expiresAt) {
      return NextResponse.json(
        { error: "menuItemId, discountPercent, and expiresAt are required" },
        { status: 400 }
      );
    }

    if (typeof discountPercent !== "number" || discountPercent < 1 || discountPercent > 100) {
      return NextResponse.json(
        { error: "discountPercent must be between 1 and 100" },
        { status: 400 }
      );
    }

    const expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime()) || expiry <= new Date()) {
      return NextResponse.json(
        { error: "expiresAt must be a valid future date/time" },
        { status: 400 }
      );
    }

    // ── Validate menu item exists and is active ─────────────────
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        dailySpecials: {
          where: { date: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      },
    });

    if (!menuItem || !menuItem.isActive) {
      return NextResponse.json(
        { error: "Menu item not found or inactive" },
        { status: 404 }
      );
    }

    // ── Check no active deal already exists for this item today ─
    const existing = await prisma.flashDeal.findFirst({
      where: {
        menuItemId,
        expiresAt: { gt: new Date() },
        cancelledAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An active Flash Deal already exists for this item today" },
        { status: 409 }
      );
    }

    // ── Snapshot Cook Plan target & units sold ──────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cookPlan = await prisma.cookPlanItem.findFirst({
      where: { date: today, menuItemId, status: "CONFIRMED" },
    });

    const unitsSold = await prisma.orderItem.aggregate({
      where: {
        menuItemId,
        order: { createdAt: { gte: today } },
      },
      _sum: { quantity: true },
    });

    // ── Create Flash Deal ───────────────────────────────────────
    const deal = await prisma.flashDeal.create({
      data: {
        menuItemId,
        discountPercent,
        cookPlanTarget: cookPlan?.finalQty ?? 0,
        unitsSoldAtStart: unitsSold._sum.quantity ?? 0,
        message: message || null,
        expiresAt: expiry,
        createdBy: auth.userId,
      },
    });

    // ── Build payload for socket broadcast ──────────────────────
    const dailySpecial = menuItem.dailySpecials[0];
    const effectivePrice = dailySpecial
      ? Number(dailySpecial.specialPrice)
      : Number(menuItem.basePrice);
    const discountedPrice =
      Math.round(effectivePrice * (1 - discountPercent / 100) * 100) / 100;

    const socketPayload: FlashDealPayload = {
      id: deal.id,
      menuItemId: deal.menuItemId,
      menuItemName: menuItem.name,
      dietaryType: menuItem.dietaryType,
      imageUrl: menuItem.imageUrl,
      basePrice: effectivePrice,
      discountPercent: deal.discountPercent,
      discountedPrice,
      message: deal.message,
      expiresAt: deal.expiresAt.toISOString(),
    };

    // ── Broadcast to students ───────────────────────────────────
    emitFlashDealPublished(socketPayload);

    return NextResponse.json(deal, { status: 201 });
  } catch (err) {
    console.error("[flash-deals] POST failed:", err);
    return NextResponse.json(
      { error: "Failed to create flash deal" },
      { status: 500 }
    );
  }
}
