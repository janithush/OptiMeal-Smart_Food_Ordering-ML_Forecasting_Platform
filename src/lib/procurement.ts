import { prisma } from "@/lib/prisma";
import { calculateForecastedNeed, getTomorrowDate, getTodayDate } from "@/lib/inventory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcurementAlertRow {
  id: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  date: string;
  currentStock: number;
  forecastedNeed: number;
  deficit: number;
  reorderQty: number;
  tier: string;
  isResolved: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Run Procurement Check
// ---------------------------------------------------------------------------

/**
 * Run a procurement check for all ingredients.
 */
export async function runProcurementCheck(): Promise<{
  alertsCreated: number;
  alertsResolved: number;
  alerts: Array<{ ingredientId: string; ingredientName: string; deficit: number }>;
}> {
  const today = getTodayDate();
  const tomorrow = getTomorrowDate();

  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
    include: {
      inventoryRecords: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  let alertsCreated = 0;
  let alertsResolved = 0;
  const activeAlerts: Array<{ ingredientId: string; ingredientName: string; deficit: number }> = [];

  for (const ingredient of ingredients) {
    const latestRecord = ingredient.inventoryRecords[0];
    if (!latestRecord) continue;

    const currentStock = Number(
      latestRecord.closingStock !== null
        ? latestRecord.closingStock
        : latestRecord.openingStock
    );

    const { total: forecastedNeed, hasForecast } =
      await calculateForecastedNeed(ingredient.id, tomorrow);

    if (!hasForecast) continue;

    const bufferThreshold = forecastedNeed * 1.15;
    let tier: string | null = null;
    let deficit = 0;

    if (currentStock < forecastedNeed) {
      tier = "CRITICAL";
      deficit = forecastedNeed - currentStock;
    } else if (currentStock < bufferThreshold) {
      tier = "WARNING";
      deficit = 0; // No actual deficit yet — stock is still sufficient
    }

    if (tier) {
      const existing = await prisma.procurementAlert.findFirst({
        where: {
          ingredientId: ingredient.id,
          date: today,
          isResolved: false,
        },
      });

      if (existing) {
        await prisma.procurementAlert.update({
          where: { id: existing.id },
          data: { currentStock, forecastedNeed, deficit, tier },
        });
      } else {
        await prisma.procurementAlert.create({
          data: {
            ingredientId: ingredient.id,
            date: today,
            currentStock,
            forecastedNeed,
            deficit,
            tier,
            isResolved: false,
          },
        });
        alertsCreated++;
      }

      activeAlerts.push({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        deficit,
      });
    } else {
      const existing = await prisma.procurementAlert.findFirst({
        where: {
          ingredientId: ingredient.id,
          date: today,
          isResolved: false,
        },
      });

      if (existing) {
        await prisma.procurementAlert.update({
          where: { id: existing.id },
          data: { isResolved: true },
        });
        alertsResolved++;
      }
    }
  }

  return { alertsCreated, alertsResolved, alerts: activeAlerts };
}

// ---------------------------------------------------------------------------
// Get Alerts
// ---------------------------------------------------------------------------

/**
 * Get all unresolved procurement alerts for today.
 */
export async function getProcurementAlerts(): Promise<ProcurementAlertRow[]> {
  const today = getTodayDate();

  const alerts = await prisma.procurementAlert.findMany({
    where: {
      date: today,
      isResolved: false,
    },
    include: {
      ingredient: { select: { name: true, unit: true } },
    },
    orderBy: { deficit: "desc" },
  });

  return alerts.map((a) => {
    const deficit = Number(a.deficit);
    const reorderQty = deficit > 0 ? Math.ceil(deficit * 1.10 * 10) / 10 : 0; // 10% buffer, only for CRITICAL
    return {
      id: a.id,
      ingredientId: a.ingredientId,
      ingredientName: a.ingredient.name,
      unit: a.ingredient.unit,
      date: a.date.toISOString().split("T")[0],
      currentStock: Number(a.currentStock),
      forecastedNeed: Number(a.forecastedNeed),
      deficit,
      reorderQty,
      tier: a.tier,
      isResolved: a.isResolved,
      createdAt: a.createdAt.toISOString(),
    };
  });
}

/**
 * Get all unresolved alert ingredient IDs with their tier for today (for inventory row highlighting).
 * Returns Map<ingredientId, tier>.
 */
export async function getProcurableIngredientIds(): Promise<Map<string, string>> {
  const today = getTodayDate();
  const alerts = await prisma.procurementAlert.findMany({
    where: { date: today, isResolved: false },
    select: { ingredientId: true, tier: true },
  });
  const map = new Map<string, string>();
  for (const a of alerts) {
    // Prefer CRITICAL over WARNING if both exist (shouldn't happen, but safety)
    if (!map.has(a.ingredientId) || a.tier === "CRITICAL") {
      map.set(a.ingredientId, a.tier);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Resolve Alerts
// ---------------------------------------------------------------------------

/**
 * Mark all unresolved alerts for today as resolved.
 * Called after PDF PO generation.
 */
export async function resolveAllAlerts(): Promise<number> {
  const today = getTodayDate();
  const result = await prisma.procurementAlert.updateMany({
    where: { date: today, isResolved: false },
    data: { isResolved: true },
  });
  return result.count;
}
