import { prisma } from "@/lib/prisma";

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
 * Calculate tomorrow's date (start of day) in UTC.
 */
export function getTomorrowDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/**
 * Calculate today's date (start of day) in UTC.
 */
export function getTodayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Validate stock entry date:
 * - Cannot be more than 1 day in the past
 * - Cannot be in the future
 *
 * Returns null if valid, or an error message string.
 */
export function validateStockDate(dateStr: string): string | null {
  const entryDate = new Date(dateStr + "T00:00:00Z");
  const today = getTodayDate();

  // Calculate one day ago (UTC)
  const oneDayAgo = new Date(today);
  oneDayAgo.setUTCDate(oneDayAgo.getUTCDate() - 1);

  if (entryDate < oneDayAgo) {
    return "Stock entries cannot be backdated more than 1 day.";
  }

  if (entryDate > today) {
    return "Stock entries cannot be future-dated.";
  }

  return null;
}

/**
 * Validate stock amounts:
 * - openingStock must be >= 0
 * - closingStock if provided must be >= 0
 *
 * Returns null if valid, or an error message string.
 */
export function validateStockAmounts(
  openingStock: number,
  closingStock: number | null
): string | null {
  if (openingStock < 0) {
    return "Opening stock cannot be negative.";
  }
  if (closingStock !== null && closingStock < 0) {
    return "Closing stock cannot be negative.";
  }
  return null;
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
  closingStock: number | null;
  wastage: number | null;
  forecastedNeed: number | null;
  hasForecast: boolean;
}

export async function buildInventoryRows(
  date: Date
): Promise<IngredientInventoryRow[]> {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
  });

  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

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

    // Get forecasted need for tomorrow
    const { total: forecastedNeed, hasForecast } =
      await calculateForecastedNeed(ingredient.id, tomorrow);

    rows.push({
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      openingStock: record ? Number(record.openingStock) : null,
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
