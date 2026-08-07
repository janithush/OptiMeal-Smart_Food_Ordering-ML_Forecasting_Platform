import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/menu — List all menu items (active + inactive)
 * POST /api/admin/menu — Create new menu item
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = await prisma.menuItem.findMany({
    include: {
      ingredients: { include: { ingredient: { select: { name: true, unit: true } } } },
      dailySpecials: { where: { date: today }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      basePrice: Number(item.basePrice),
      dietaryType: item.dietaryType,
      imageUrl: item.imageUrl,
      isActive: item.isActive,
      ingredients: item.ingredients.map((mi) => ({
        ingredientId: mi.ingredientId,
        name: mi.ingredient.name,
        unit: mi.ingredient.unit,
        quantityPerPortion: Number(mi.quantityPerPortion),
      })),
      todaySpecial: item.dailySpecials[0]
        ? { id: item.dailySpecials[0].id, specialPrice: Number(item.dailySpecials[0].specialPrice), description: item.dailySpecials[0].description }
        : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const basePrice = Number(body.basePrice ?? 0);
  const dietaryType = String(body.dietaryType ?? "");
  const description = body.description ? String(body.description) : null;
  const imageUrl = body.imageUrl ? String(body.imageUrl) : null;
  const ingredients: { ingredientId: string; quantityPerPortion: number }[] = Array.isArray(body.ingredients) ? body.ingredients : [];

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (basePrice <= 0) return NextResponse.json({ error: "Price must be > 0" }, { status: 400 });
  if (!["VEGAN", "VEGETARIAN", "NON_VEGETARIAN"].includes(dietaryType)) {
    return NextResponse.json({ error: "Invalid dietary type" }, { status: 400 });
  }

  // Validate image size
  if (imageUrl && imageUrl.length > 600_000) {
    return NextResponse.json({ error: "Image too large (max 500KB)" }, { status: 400 });
  }

  const item = await prisma.menuItem.create({
    data: {
      name,
      basePrice,
      dietaryType: dietaryType as "VEGAN" | "VEGETARIAN" | "NON_VEGETARIAN",
      description,
      imageUrl,
      ingredients: ingredients.length > 0
        ? { create: ingredients.map((i) => ({ ingredientId: i.ingredientId, quantityPerPortion: i.quantityPerPortion || 0 })) }
        : undefined,
    },
    include: {
      ingredients: { include: { ingredient: { select: { name: true, unit: true } } } },
    },
  });

  return NextResponse.json({
    item: {
      id: item.id,
      name: item.name,
      description: item.description,
      basePrice: Number(item.basePrice),
      dietaryType: item.dietaryType,
      imageUrl: item.imageUrl,
      isActive: item.isActive,
      ingredients: item.ingredients.map((mi) => ({
        ingredientId: mi.ingredientId,
        name: mi.ingredient.name,
        unit: mi.ingredient.unit,
        quantityPerPortion: Number(mi.quantityPerPortion),
      })),
      todaySpecial: null,
    },
  }, { status: 201 });
}
