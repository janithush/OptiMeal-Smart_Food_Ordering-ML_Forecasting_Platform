import { verifyApiAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ensureTodaysSlots, toDisplayLabel } from "@/lib/slots";
import { NextResponse } from "next/server";
import type { DietaryType } from "@/types/menu";

/**
 * GET /api/student/group-orders/init — Get menu items + slots for group order page
 */
export async function GET() {
  const { error } = await verifyApiAuth();
  if (error) return error;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const menuItems = await prisma.menuItem.findMany({
    where: { isActive: true },
    include: {
      orderItems: {
        where: { order: { createdAt: { gte: todayStart, lte: todayEnd } } },
        select: { quantity: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const MAX_PER_ITEM = 100;
  const items = menuItems.map((item) => {
    const totalOrdered = item.orderItems.reduce((sum, oi) => sum + oi.quantity, 0);
    const pct = totalOrdered / MAX_PER_ITEM;
    return {
      id: item.id,
      name: item.name,
      basePrice: Number(item.basePrice),
      dietaryType: item.dietaryType as DietaryType,
      imageUrl: item.imageUrl,
      specialPrice: null,
      availability: (pct >= 0.9 ? "Sold Out" : pct >= 0.6 ? "Selling Fast" : "Available") as string,
    };
  });

  const rawSlots = await ensureTodaysSlots();
  const slots = rawSlots.map((s) => ({
    id: s.id,
    slotTime: s.slotTime,
    displayLabel: toDisplayLabel(s.slotTime),
    maxCapacity: s.maxCapacity,
    currentCount: s.currentCount,
  }));

  return NextResponse.json({ menuItems: items, slots });
}
