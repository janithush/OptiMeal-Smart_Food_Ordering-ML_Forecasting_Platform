import { getIO } from "./socket-server";
import { prisma } from "./prisma";
import { toDisplayLabel } from "./slots";

export interface DashboardPayload {
  totalOrders: number;
  totalRevenue: number;
  preOrderCount: number;
  walkInCount: number;
  itemsSold: { name: string; units: number }[];
  hourlySales: { hour: string; orders: number; revenue: number }[];
  slotQueueDepths: { slotId: string; label: string; depth: number; max: number }[];
  updatedAt: string;
}

export interface FlashDealPayload {
  id: string;
  menuItemId: string;
  menuItemName: string;
  dietaryType: string;
  imageUrl: string | null;
  basePrice: number;
  discountPercent: number;
  discountedPrice: number;
  message: string | null;
  expiresAt: string;
}

export interface SmartDiscountAlertPayload {
  menuItemId: string;
  name: string;
  cookPlanTarget: number;
  unitsSold: number;
  percentSold: number;
  currentPrice: number;
  checkedAt: string;
}

export interface OrderStatusPayload {
  orderId: string;
  status: string;
  orderNumber: string;
  slotDisplay: string | null;
  timestamp: string;
}

/**
 * Emit an order status change to the specific student's Socket.io room.
 * Target: student/{user:userId} room on the /student namespace.
 * Also emits to the general /student namespace for dashboard-style views.
 */
export function emitOrderStatusUpdate(
  orderId: string,
  status: string,
  orderNumber: string,
  userId: string,
  slotDisplay?: string | null
) {
  let io: ReturnType<typeof getIO>;
  try {
    io = getIO();
  } catch {
    console.warn("[events] emitOrderStatusUpdate skipped — IO not initialized");
    return;
  }
  const payload: OrderStatusPayload = {
    orderId,
    status,
    orderNumber,
    slotDisplay: slotDisplay ?? null,
    timestamp: new Date().toISOString(),
  };

  // Target the specific student's private room only. There is no global
  // broadcast on /student — the namespace is JWT-protected and each
  // user has their own room, so emitting to the room is sufficient.
  io.of("/student").to(`user:${userId}`).emit("orderStatusChanged", payload);

  console.log(`[events] orderStatusChanged → user:${userId} | ${orderNumber} → ${status}`);
}

/**
 * Emit live dashboard KPIs to all /admin sockets.
 * Called after order creation, top-up webhook, and status changes.
 * All queries are anonymised aggregations — no student data exposed (NFR-8).
 */
export async function emitDashboardRefresh() {
  let io: ReturnType<typeof getIO>;
  try {
    io = getIO();
  } catch {
    console.warn("[events] emitDashboardRefresh skipped — IO not initialized");
    return;
  }
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

    // ── Items sold (anonymised: no student data) ──────────────
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
      const h = i + 8; // 08:00 – 22:00
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
    console.error("[events] emitDashboardRefresh query failed:", err);
    // Still emit whatever we have (partial data beats no data)
  }

  io.of("/admin").emit("dashboardUpdate", payload);
  console.log(`[events] dashboardUpdate → ${payload.totalOrders} orders, Rs.${payload.totalRevenue}`);
}

/**
 * Emit a Flash Deal to all connected /student sockets.
 * Called after Admin creates a Flash Deal (Story 6.4).
 */
export function emitFlashDealPublished(payload: FlashDealPayload) {
  let io: ReturnType<typeof getIO>;
  try {
    io = getIO();
  } catch {
    console.warn("[events] emitFlashDealPublished skipped — IO not initialized");
    return;
  }
  io.of("/student").emit("flashDealPublished", payload);
  io.of("/admin").emit("flashDealCreated", payload);
  console.log(`[events] flashDealPublished → ${payload.menuItemName} @ ${payload.discountPercent}% off`);
}

/**
 * Emit Flash Deal cancellation to all connected /student and /admin sockets.
 * Called when Admin cancels an active Flash Deal (Story 6.4).
 */
export function emitFlashDealCancelled(flashDealId: string, menuItemId: string) {
  let io: ReturnType<typeof getIO>;
  try {
    io = getIO();
  } catch {
    console.warn("[events] emitFlashDealCancelled skipped — IO not initialized");
    return;
  }
  const payload = { flashDealId, menuItemId };
  io.of("/student").emit("flashDealCancelled", payload);
  io.of("/admin").emit("flashDealCancelled", payload);
  console.log(`[events] flashDealCancelled → ${flashDealId}`);
}

/**
 * Emit a Smart Discount alert to all connected /admin sockets.
 * Called by the 12:30 PM scheduler or manual check (Story 6.4).
 */
export function emitSmartDiscountAlert(payload: SmartDiscountAlertPayload) {
  let io: ReturnType<typeof getIO>;
  try {
    io = getIO();
  } catch {
    console.warn("[events] emitSmartDiscountAlert skipped — IO not initialized");
    return;
  }
  io.of("/admin").emit("smartDiscountAlert", payload);
  console.log(`[events] smartDiscountAlert → ${payload.name}: ${payload.percentSold.toFixed(1)}% of ${payload.cookPlanTarget}`);
}
