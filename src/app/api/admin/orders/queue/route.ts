import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/orders/queue — Active pre-orders grouped by pickup slot
 * Admin-only. Returns today's pending orders excluding COLLECTED & CANCELLED.
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: today },
      type: "PRE_ORDER",
      status: { notIn: ["COLLECTED", "CANCELLED"] },
    },
    include: {
      student: { select: { name: true } },
      items: {
        include: {
          menuItem: { select: { name: true } },
        },
      },
      pickupSlot: { select: { slotTime: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by slot
  const slotsMap = new Map<string, {
    slotTime: string;
    orders: {
      id: string;
      orderNumber: string;
      studentName: string;
      status: string;
      totalAmount: number;
      type: string;
      qrCode: string;
      items: { name: string; quantity: number; price: number }[];
      createdAt: string;
    }[];
  }>();

  // Also get all today's slots for empty groups
  const allSlots = await prisma.pickupSlot.findMany({
    where: { date: today },
    select: { slotTime: true },
    orderBy: { slotTime: "asc" },
  });

  for (const slot of allSlots) {
    slotsMap.set(slot.slotTime, { slotTime: slot.slotTime, orders: [] });
  }

  for (const order of orders) {
    const slotKey = order.pickupSlot?.slotTime ?? "No Slot";
    if (!slotsMap.has(slotKey)) {
      slotsMap.set(slotKey, { slotTime: slotKey, orders: [] });
    }
    slotsMap.get(slotKey)!.orders.push({
      id: order.id,
      orderNumber: order.orderNumber,
      studentName: order.student.name,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      type: order.type,
      qrCode: order.qrCode,
      items: order.items.map((oi) => ({
        name: oi.menuItem.name,
        quantity: oi.quantity,
        price: Number(oi.unitPrice),
      })),
      createdAt: order.createdAt.toISOString(),
    });
  }

  // Convert to sorted array
  const slots = [...slotsMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slotTime, group]) => ({
      slotTime,
      count: group.orders.length,
      orders: group.orders,
    }));

  return NextResponse.json({ slots });
}
