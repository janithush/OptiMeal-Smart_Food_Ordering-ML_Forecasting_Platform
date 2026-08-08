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

  for (const ingredient of ingredients) {
    // Get today's inventory record
    const record = await prisma.inventoryRecord.findUnique({
      where: {
        ingredientId_date: {
          ingredientId: ingredient.id,
          date,
        },
      },
    });

    // Auto-carryover: yesterday's closing → today's opening (today only, no cascading)
    let openingStock: number | null = record ? Number(record.openingStock) : null;
    if (!record) {
      const todayDate = getTodayDate();
      const isToday =
        date.getUTCFullYear() === todayDate.getUTCFullYear() &&
        date.getUTCMonth() === todayDate.getUTCMonth() &&
        date.getUTCDate() === todayDate.getUTCDate();
      if (isToday) {
        const yesterday = new Date(date);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const prevRecord = await prisma.inventoryRecord.findUnique({
          where: {
            ingredientId_date: {
              ingredientId: ingredient.id,
              date: yesterday,
            },
          },
        });
        if (prevRecord?.closingStock !== null && prevRecord?.closingStock !== undefined) {
          openingStock = Number(prevRecord.closingStock);
        }
      }
    }

    // Get forecasted need for tomorrow
    const { total: forecastedNeed, hasForecast } =
      await calculateForecastedNeed(ingredient.id, tomorrow);

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
      forecastedNeed: hasForecast ? forecastedNeed : null,
      hasForecast,
    });
  }

  return rows;
}
