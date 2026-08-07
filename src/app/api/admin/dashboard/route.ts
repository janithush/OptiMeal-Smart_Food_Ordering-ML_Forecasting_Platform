import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { toDisplayLabel } from "@/lib/slots";
import type { DashboardPayload } from "@/lib/order-events";

/**
 * GET /api/admin/dashboard — Initial dashboard data
 * Uses requireApiRole("ADMIN") for auth (AD-4).
 * All queries are anonymised aggregations — no student data (NFR-8).
 */
export async function GET() {
  const result = await requireApiRole("ADMIN");
  if (result.error) return result.error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const payload: DashboardPayload = {
    totalOrders: 0,
    totalRevenue: 0,
    preOrderCount: 0,
    walkInCount: 0,
    itemsSold: [],
    hourlySales: [],
    slotQueueDepths: [],
    updatedAt: new Date().toISOString(),
  };

  try {
    // ── Total orders + revenue today ──────────────────────────
    const todayAgg = await prisma.order.aggregate({
      where: { createdAt: { gte: today } },
      _count: true,
      _sum: { totalAmount: true },
    });
    payload.totalOrders = todayAgg._count;
    payload.totalRevenue = Number(todayAgg._sum.totalAmount ?? 0);

    // ── Pre-Order / Walk-In split ─────────────────────────────
    const typeAgg = await prisma.order.groupBy({
      by: ["type"],
      where: { createdAt: { gte: today } },
      _count: true,
    });
    payload.preOrderCount = Number(typeAgg.find((r) => r.type === "PRE_ORDER")?._count ?? 0);
    payload.walkInCount = Number(typeAgg.find((r) => r.type === "WALK_IN")?._count ?? 0);

    // ── Items sold ────────────────────────────────────────────
    const itemsSold = await prisma.$queryRawUnsafe<{ name: string; units: bigint }[]>(
      `SELECT mi."name", COALESCE(SUM(oi."quantity"), 0)::bigint as units
       FROM "MenuItem" mi
       LEFT JOIN "OrderItem" oi ON oi."menuItemId" = mi."id"
       LEFT JOIN "Order" o ON oi."orderId" = o."id" AND o."createdAt" >= $1
       WHERE mi."isActive" = true
       GROUP BY mi."name"
       ORDER BY units DESC
       LIMIT 10`,
      today
    );
    payload.itemsSold = itemsSold.map((r) => ({ name: r.name, units: Number(r.units) }));

    // ── Hourly sales ──────────────────────────────────────────
    const hourlySales = await prisma.$queryRawUnsafe<{ hour: number; orders: bigint; revenue: number }[]>(
      `SELECT EXTRACT(HOUR FROM "createdAt")::int as hour,
              COUNT(*)::bigint as orders,
              COALESCE(SUM("totalAmount"), 0) as revenue
       FROM "Order"
       WHERE "createdAt" >= $1
       GROUP BY EXTRACT(HOUR FROM "createdAt")
       ORDER BY hour`,
      today
    );
    payload.hourlySales = Array.from({ length: 15 }, (_, i) => {
      const h = i + 8;
      const match = hourlySales.find((r) => r.hour === h);
      return {
        hour: `${String(h).padStart(2, "0")}:00`,
        orders: match ? Number(match.orders) : 0,
        revenue: match ? Number(match.revenue) : 0,
      };
    });

    // ── Slot queue depths ─────────────────────────────────────
    const slots = await prisma.pickupSlot.findMany({
      where: { date: today },
      select: { id: true, slotTime: true, currentCount: true, maxCapacity: true },
      orderBy: { slotTime: "asc" },
    });
    payload.slotQueueDepths = slots.map((s) => ({
      slotId: s.id,
      label: toDisplayLabel(s.slotTime),
      depth: s.currentCount,
      max: s.maxCapacity,
    }));
  } catch (err) {
    console.error("[dashboard] query error:", err);
    // Return partial data rather than failing entirely
  }

  return NextResponse.json(payload);
}
