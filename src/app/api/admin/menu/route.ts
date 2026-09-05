import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { menuItemCreateSchema } from "@/lib/validation/schemas";
import { validateImageUrl } from "@/lib/validation/images";

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

  const parsed = menuItemCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { name, basePrice, dietaryType, description, imageUrl, ingredients } = parsed.data;

  // Whitelist image MIME types (JPEG, PNG, WebP) with 5MB limit.
  const imgErr = validateImageUrl(imageUrl ?? null);
  if (imgErr) return NextResponse.json({ error: imgErr }, { status: 400 });

  const item = await prisma.$transaction(
    async (tx) => {
      // Validate ingredient IDs exist (fail-closed inside atomic tx).
      if (ingredients && ingredients.length > 0) {
        const count = await tx.ingredient.count({
          where: { id: { in: ingredients.map((i) => i.ingredientId) }, isActive: true },
        });
        if (count !== ingredients.length) {
          throw new Error("INVALID_INGREDIENTS");
        }
      }
      return tx.menuItem.create({
        data: {
          name,
          basePrice,
          dietaryType,
          description: description ?? null,
          imageUrl: imageUrl ?? null,
          ingredients:
            ingredients && ingredients.length > 0
              ? {
                  create: ingredients.map((i) => ({
                    ingredientId: i.ingredientId,
                    quantityPerPortion: i.quantityPerPortion,
                  })),
                }
              : undefined,
        },
        include: {
          ingredients: { include: { ingredient: { select: { name: true, unit: true } } } },
        },
      });
    },
    { maxWait: 5000, timeout: 20000 }
  ).catch((e: unknown) => {
    if (e instanceof Error && e.message === "INVALID_INGREDIENTS") return null;
    throw e;
  });

  if (!item) {
    return NextResponse.json({ error: "Invalid ingredients" }, { status: 400 });
  }

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
