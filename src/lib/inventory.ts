import { prisma } from "@/lib/prisma";
import { getTodayDate } from "@/lib/date-utils";

// Re-export date utilities for backward compatibility (all server files import from here).
// Client components should import directly from "@/lib/date-utils" instead.
export { getTodayDate, getTomorrowDate, getColomboDateString, validateStockDate, validateStockAmounts } from "@/lib/date-utils";

/**
 * Calculate the forecasted need for a single ingredient for tomorrow.
 *
 * Forecasted need = SUM over all MenuItemIngredient links:
 *   MenuItemIngredient.quantityPerPortion × DemandForecast.predictedQty
 *
 * Returns the total quantity needed in the ingredient's unit (kg/liters),
 * or null if no DemandForecast records exist yet for tomorrow.
 *
 * NOTE (Story 7.5): Wastage = openingStock - closingStock - soldPortions.
 * The soldPortions mapping is deferred to Story 7.5 (Wastage Heatmap).
 */
export async function calculateForecastedNeed(
  ingredientId: string,
  tomorrow: Date
): Promise<{ total: number; hasForecast: boolean }> {
  const links = await prisma.menuItemIngredient.findMany({
    where: { ingredientId },
    include: {
      menuItem: {
        include: {
          demandForecasts: {
            where: { date: tomorrow },
          },
        },
      },
    },
  });

  let total = 0;
  let hasForecast = false;

  for (const link of links) {
    const forecast = link.menuItem.demandForecasts[0];
    if (forecast) {
      hasForecast = true;
      total += Number(link.quantityPerPortion) * forecast.predictedQty;
    }
  }

  return { total, hasForecast };
}

/**
 * Batch-calculate forecasted need for all ingredients at once.
 * Avoids N+1 queries by loading all MenuItemIngredient + DemandForecast in 2 queries.
 */
export async function calculateForecastedNeedBatch(
  ingredientIds: string[],
  tomorrow: Date
): Promise<Map<string, { total: number; hasForecast: boolean }>> {
  const result = new Map<string, { total: number; hasForecast: boolean }>();

  // Batch-load all MenuItemIngredient links + nested DemandForecast
  const links = await prisma.menuItemIngredient.findMany({
    where: { ingredientId: { in: ingredientIds } },
    include: {
      menuItem: {
        include: {
          demandForecasts: { where: { date: tomorrow } },
        },
      },
    },
  });

  // Aggregate per ingredientId
  for (const link of links) {
    const forecast = link.menuItem.demandForecasts[0];
    if (!forecast) continue;

    const existing = result.get(link.ingredientId);
    const contribution = Number(link.quantityPerPortion) * forecast.predictedQty;
    if (existing) {
      existing.total += contribution;
    } else {
      result.set(link.ingredientId, { total: contribution, hasForecast: true });
    }
  }

  // Fill in zero for ingredients with no links
  for (const id of ingredientIds) {
    if (!result.has(id)) {
      result.set(id, { total: 0, hasForecast: false });
    }
  }

  return result;
}

/**
 * Build the inventory response for a single ingredient.
 * Includes today's stock record (if any) and forecasted need.
 */
export interface IngredientInventoryRow {
  id: string;
  name: string;
  unit: string;
  openingStock: number | null;
  receivedStock: number | null;
  consumedStock: number | null;
  closingStock: number | null;
  wastage: number | null;
  forecastedNeed: number | null;
  hasForecast: boolean;
}

export async function buildInventoryRows(
  date: Date
): Promise<IngredientInventoryRow[]> {
  const ingredients = await prisma.ingredient.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const tomorrow = new Date(date);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  const rows: IngredientInventoryRow[] = [];

  // Batch-load all inventory records for this date and yesterday in one query each
  const yesterday = new Date(date);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const [todayRecords, yesterdayRecords] = await Promise.all([
    prisma.inventoryRecord.findMany({
      where: {
        ingredientId: { in: ingredients.map(function (i) { return i.id; }) },
        date,
      },
    }),
    prisma.inventoryRecord.findMany({
      where: {
        ingredientId: { in: ingredients.map(function (i) { return i.id; }) },
        date: yesterday,
      },
    }),
  ]);

  // Index by ingredientId for O(1) lookup
  const todayMap = new Map(todayRecords.map(function (r) { return [r.ingredientId, r] as [string, typeof r]; }));
  const yesterdayMap = new Map(yesterdayRecords.map(function (r) { return [r.ingredientId, r] as [string, typeof r]; }));

  const todayDate = getTodayDate();
  const isToday =
    date.getUTCFullYear() === todayDate.getUTCFullYear() &&
    date.getUTCMonth() === todayDate.getUTCMonth() &&
    date.getUTCDate() === todayDate.getUTCDate();

  // Batch-load forecasted need for all ingredients (avoids N+1)
  const forecastMap = await calculateForecastedNeedBatch(
    ingredients.map(function (i) { return i.id; }),
    tomorrow
  );

  for (const ingredient of ingredients) {
    // Get today's inventory record (from batch-loaded map)
    const record = todayMap.get(ingredient.id);

    // Auto-carryover: yesterday's closing → today's opening (today only, no cascading)
    let openingStock: number | null = record ? Number(record.openingStock) : null;
    if (!record && isToday) {
      const prevRecord = yesterdayMap.get(ingredient.id);
      if (prevRecord?.closingStock !== null && prevRecord?.closingStock !== undefined) {
        openingStock = Number(prevRecord.closingStock);
      }
    }

    // Get forecasted need from batch
    const fc = forecastMap.get(ingredient.id) ?? { total: 0, hasForecast: false };

    rows.push({
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      openingStock,
      receivedStock:
        record && record.receivedStock !== null
          ? Number(record.receivedStock)
          : null,
      consumedStock:
        record && record.consumedStock !== null
          ? Number(record.consumedStock)
          : null,
      closingStock:
        record && record.closingStock !== null
          ? Number(record.closingStock)
          : null,
      wastage:
        record && record.wastage !== null ? Number(record.wastage) : null,
      forecastedNeed: fc.hasForecast ? fc.total : null,
      hasForecast: fc.hasForecast,
    });
  }

  return rows;
}
