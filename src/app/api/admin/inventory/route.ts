import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  buildInventoryRows,
  validateStockDate,
  validateStockAmounts,
  getTodayDate,
} from "@/lib/inventory";

/**
 * GET /api/admin/inventory
 *
 * Returns today's inventory records with forecasted need per ingredient.
 *
 * Query params:
 *   date: YYYY-MM-DD (optional, defaults to today)
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");

  let date: Date;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    date = new Date(dateParam + "T00:00:00Z");
  } else {
    date = getTodayDate();
  }

  const ingredients = await buildInventoryRows(date);

  return NextResponse.json({
    date: date.toISOString().split("T")[0],
    ingredients,
  });
}

/**
 * POST /api/admin/inventory
 *
 * Create or update an inventory record for a specific ingredient on a specific date.
 * Uses upsert on (ingredientId, date) unique constraint.
 *
 * Body:
 *   ingredientId: string (required)
 *   date: YYYY-MM-DD (required)
 *   openingStock: number (required, >= 0)
 *   receivedStock: number | null (optional, >= 0)
 *   consumedStock: number | null (optional, >= 0)
 *   closingStock: number | null (optional, >= 0)
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ingredientId = String(body.ingredientId ?? "").trim();
  const dateStr = String(body.date ?? "").trim();
  const openingStock = Number(body.openingStock);

  if (!ingredientId) {
    return NextResponse.json(
      { error: "ingredientId is required" },
      { status: 400 }
    );
  }

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: "date is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // Check ingredient exists
  const ingredient = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
  });
  if (!ingredient) {
    return NextResponse.json(
      { error: "Ingredient not found" },
      { status: 404 }
    );
  }

  // Validate date
  const dateError = validateStockDate(dateStr);
  if (dateError) {
    return NextResponse.json({ error: dateError }, { status: 400 });
  }

  // Validate amounts
  const receivedStock = body.receivedStock !== undefined && body.receivedStock !== null
    ? Number(body.receivedStock)
    : null;
  const consumedStock = body.consumedStock !== undefined && body.consumedStock !== null
    ? Number(body.consumedStock)
    : null;
  const closingStock = body.closingStock !== undefined && body.closingStock !== null
    ? Number(body.closingStock)
    : null;

  if (Number.isNaN(openingStock)) {
    return NextResponse.json(
      { error: "openingStock must be a valid number" },
      { status: 400 }
    );
  }

  const amountError = validateStockAmounts(openingStock, receivedStock, consumedStock, closingStock);
  if (amountError) {
    return NextResponse.json({ error: amountError }, { status: 400 });
  }

  const date = new Date(dateStr + "T00:00:00Z");

  // Calculate wastage: openingStock + receivedStock - consumedStock - closingStock
  const received = receivedStock ?? 0;
  const consumed = consumedStock ?? 0;
  const wastage =
    closingStock !== null ? openingStock + received - consumed - closingStock : null;

  const record = await prisma.inventoryRecord.upsert({
    where: {
      ingredientId_date: {
        ingredientId,
        date,
      },
    },
    create: {
      ingredientId,
      date,
      openingStock,
      receivedStock,
      consumedStock,
      closingStock,
      wastage,
    },
    update: {
      openingStock,
      receivedStock,
      consumedStock,
      closingStock,
      wastage,
    },
  });

  return NextResponse.json({
    record: {
      id: record.id,
      ingredientId: record.ingredientId,
      date: record.date.toISOString().split("T")[0],
      openingStock: Number(record.openingStock),
      receivedStock: record.receivedStock !== null ? Number(record.receivedStock) : null,
      consumedStock: record.consumedStock !== null ? Number(record.consumedStock) : null,
      closingStock: record.closingStock !== null ? Number(record.closingStock) : null,
      wastage: record.wastage !== null ? Number(record.wastage) : null,
      createdAt: record.createdAt.toISOString(),
    },
  });
}
