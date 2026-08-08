import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getTodayDate } from "@/lib/inventory";

/**
 * GET /api/admin/inventory/history
 *
 * Returns 7-day history of inventory records for all ingredients.
 *
 * Query params:
 *   from: YYYY-MM-DD (optional, defaults to 7 days ago)
 *   to: YYYY-MM-DD (optional, defaults to today)
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const today = getTodayDate();

  // Default: 7 days ago to today
  let fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 7);

  let toDate = new Date(today);

  if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
    fromDate = new Date(fromParam + "T00:00:00Z");
  }

  if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    toDate = new Date(toParam + "T00:00:00Z");
  }

  // Fetch ingredients
  const ingredients = await prisma.ingredient.findMany({
    select: { id: true, name: true, unit: true },
    orderBy: { name: "asc" },
  });

  // Fetch all inventory records in date range
  const records = await prisma.inventoryRecord.findMany({
    where: {
      date: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: { date: "asc" },
  });

  // Group by date
  const dateMap = new Map<string, Map<string, typeof records[number]>>();

  for (const record of records) {
    const dateKey = record.date.toISOString().split("T")[0];
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, new Map());
    }
    dateMap.get(dateKey)!.set(record.ingredientId, record);
  }

  // Build response: for each date in range, show all ingredients
  const history: Array<{
    date: string;
    ingredients: Array<{
      id: string;
      name: string;
      unit: string;
      openingStock: number | null;
      receivedStock: number | null;
      consumedStock: number | null;
      closingStock: number | null;
      wastage: number | null;
    }>;
  }> = [];

  // Iterate through each date in range
  const current = new Date(fromDate);
  while (current <= toDate) {
    const dateKey = current.toISOString().split("T")[0];
    const dateRecords = dateMap.get(dateKey);

    const dateIngredients = ingredients.map((ing) => {
      const rec = dateRecords?.get(ing.id);
      return {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        openingStock: rec ? Number(rec.openingStock) : null,
        receivedStock:
          rec && rec.receivedStock !== null
            ? Number(rec.receivedStock)
            : null,
        consumedStock:
          rec && rec.consumedStock !== null
            ? Number(rec.consumedStock)
            : null,
        closingStock:
          rec && rec.closingStock !== null
            ? Number(rec.closingStock)
            : null,
        wastage:
          rec && rec.wastage !== null ? Number(rec.wastage) : null,
      };
    });

    history.push({ date: dateKey, ingredients: dateIngredients });
    current.setDate(current.getDate() + 1);
  }

  return NextResponse.json({ history });
}
