/**
 * cook-plan.ts — Cook Plan orchestration library.
 *
 * Implements AD-9 lock lifecycle: SUGGESTED → CONFIRMED → SUPERSEDED.
 * Post-cutoff (09:05) updates pre-order counts.
 */

import { prisma } from "@/lib/prisma";
import { getTodayDate, getTomorrowDate } from "@/lib/date-utils";
import { getIO } from "@/lib/socket-server";

// ── Types ────────────────────────────────────────────────────────

export interface CookPlanItemRow {
  id: string;
  menuItemId: string;
  menuItemName: string;
  forecastQty: number;
  preOrderQty: number;
  finalQty: number;
  bufferQty: number;
  adminAdjusted: boolean;
  status: string;
  confidenceScore: number | null;
  modelVersion: string | null;
}

export interface CookPlanResult {
  itemsGenerated: number;
}

export interface PostCutoffResult {
  itemsUpdated: number;
}

export interface ConfirmResult {
  confirmed: number;
  procurementAlertsTriggered: boolean;
}

// ── Cook Plan Generation ──────────────────────────────────────────

/**
 * Generate SUGGESTED CookPlanItems for a given date from DemandForecast data.
 * Called by the 18:00 nightly forecast cron and manual trigger.
 */
export async function generateCookPlan(forDate: Date): Promise<CookPlanResult> {
  const forecasts = await prisma.demandForecast.findMany({
    where: { date: forDate },
    include: { menuItem: { select: { name: true } } },
  });

  let itemsGenerated = 0;

  for (const f of forecasts) {
    const finalQty = Math.ceil(f.predictedQty * 1.10);
    const bufferQty = finalQty - f.predictedQty;

    await prisma.cookPlanItem.upsert({
      where: {
        date_menuItemId_status: {
          date: forDate,
          menuItemId: f.menuItemId,
          status: "SUGGESTED",
        },
      },
      create: {
        date: forDate,
        menuItemId: f.menuItemId,
        forecastQty: f.predictedQty,
        preOrderQty: 0,
        finalQty,
        bufferQty,
        status: "SUGGESTED",
      },
      update: {
        forecastQty: f.predictedQty,
        finalQty,
        bufferQty,
      },
    });
    itemsGenerated++;
  }

  return { itemsGenerated };
}

// ── Post-Cutoff Update ────────────────────────────────────────────

/**
 * Run at 09:05 daily. Counts pre-orders and updates CookPlanItem records.
 * Recalculates finalQty = max(forecastQty, preOrderQty × 1.10).
 */
export async function runPostCutoffUpdate(): Promise<PostCutoffResult> {
  const today = getTodayDate();
  const todayEnd = new Date(today);
  todayEnd.setUTCHours(23, 59, 59, 999);

  // Count pre-orders per menu item for today
  const preOrderCounts = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: {
      order: {
        type: "PRE_ORDER",
        createdAt: { gte: today, lte: todayEnd },
      },
    },
    _sum: { quantity: true },
  });

  const preOrderMap = new Map<string, number>();
  for (const row of preOrderCounts) {
    preOrderMap.set(row.menuItemId, row._sum.quantity ?? 0);
  }

  // Update SUGGESTED items for today
  const items = await prisma.cookPlanItem.findMany({
    where: { date: today, status: "SUGGESTED" },
  });

  for (const item of items) {
    const preOrderQty = preOrderMap.get(item.menuItemId) ?? 0;
    const finalQty = Math.max(item.forecastQty, Math.ceil(preOrderQty * 1.10));

    await prisma.cookPlanItem.update({
      where: { id: item.id },
      data: { preOrderQty, finalQty },
    });
  }

  return { itemsUpdated: items.length };
}

// ── Confirm Cook Plan ─────────────────────────────────────────────

/**
 * Transition all SUGGESTED CookPlanItems for a given date to CONFIRMED.
 * Triggers procurement re-check after confirmation.
 * Defaults to today if no date provided.
 */
export async function confirmCookPlan(
  adminId: string,
  adminName: string,
  forDate?: string
): Promise<ConfirmResult> {
  const dateStr = forDate ?? getTodayDate().toISOString().split("T")[0];
  const date = new Date(dateStr + "T00:00:00Z");
  const now = new Date();

  console.log("[cook-plan] Confirming plan for date:", dateStr);

  const result = await prisma.cookPlanItem.updateMany({
    where: { date, status: "SUGGESTED" },
    data: {
      status: "CONFIRMED",
      confirmedAt: now,
      confirmedBy: adminId,
    },
  });

  console.log("[cook-plan] Confirmed items count:", result.count);

  // Trigger procurement re-check (fire-and-forget)
  let procurementAlertsTriggered = false;
  try {
    const { runProcurementCheck } = await import("@/lib/procurement");
    const procResult = await runProcurementCheck();
    procurementAlertsTriggered =
      procResult.alertsCreated > 0 || procResult.alertsResolved > 0;
  } catch (err) {
    console.error("[cook-plan] Procurement re-check failed:", err);
  }

  // Emit Socket.io event
  try {
    const io = getIO();
    io.of("/admin").emit("cookPlanConfirmed", {
      date: dateStr,
      confirmedBy: adminName,
      itemCount: result.count,
      timestamp: now.toISOString(),
    });
  } catch {
    // IO not initialized
  }

  return { confirmed: result.count, procurementAlertsTriggered };
}

// ── Lock Check ────────────────────────────────────────────────────

/**
 * Returns true if Cook Plan for the given date is locked.
 * Locked = all items are CONFIRMED and Colombo time is past 10:00 AM.
 * Hours are evaluated in Colombo timezone (UTC+5:30).
 */
export function isCookPlanLocked(status: string): boolean {
  if (status !== "CONFIRMED") return false;
  const colomboNow = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
  return colomboNow.getUTCHours() >= 10;
}

/**
 * Get the formatted Cook Plan for a given date with per-item details.
 */
export async function getCookPlan(forDate: Date): Promise<{
  date: string;
  isLocked: boolean;
  allConfirmed: boolean;
  items: CookPlanItemRow[];
}> {
  const items = await prisma.cookPlanItem.findMany({
    where: { date: forDate },
    include: {
      menuItem: { select: { name: true } },
    },
    orderBy: { menuItem: { name: "asc" } },
  });

  // Fetch forecast data for confidence scores
  const forecasts = await prisma.demandForecast.findMany({
    where: { date: forDate },
    select: { menuItemId: true, confidenceScore: true, modelVersion: true },
  });
  const forecastMap = new Map(
    forecasts.map((f) => [f.menuItemId, { confidenceScore: Number(f.confidenceScore), modelVersion: f.modelVersion }])
  );

  const allConfirmed = items.length > 0 && items.every((i) => i.status === "CONFIRMED");

  return {
    date: forDate.toISOString().split("T")[0],
    isLocked: allConfirmed,
    allConfirmed,
    items: items.map((i) => {
      const fc = forecastMap.get(i.menuItemId);
      return {
        id: i.id,
        menuItemId: i.menuItemId,
        menuItemName: i.menuItem.name,
        forecastQty: i.forecastQty,
        preOrderQty: i.preOrderQty,
        finalQty: i.finalQty,
        bufferQty: i.bufferQty,
        adminAdjusted: i.adminAdjusted,
        status: i.status,
        confidenceScore: fc?.confidenceScore ?? null,
        modelVersion: fc?.modelVersion ?? null,
      };
    }),
  };
}
