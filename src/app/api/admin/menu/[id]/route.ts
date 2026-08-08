import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/admin/menu/[id] — Update menu item
 * DELETE /api/admin/menu/[id] — Soft-delete or hard-delete menu item
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.basePrice !== undefined) {
    const price = Number(body.basePrice);
    if (price <= 0) return NextResponse.json({ error: "Price must be > 0" }, { status: 400 });
    data.basePrice = price;
  }
  if (body.dietaryType !== undefined) {
    if (!["VEGAN", "VEGETARIAN", "NON_VEGETARIAN"].includes(String(body.dietaryType))) {
      return NextResponse.json({ error: "Invalid dietary type" }, { status: 400 });
    }
    data.dietaryType = String(body.dietaryType);
  }
  if (body.imageUrl !== undefined) {
    const img = body.imageUrl ? String(body.imageUrl) : null;
    if (img && img.length > 600_000) return NextResponse.json({ error: "Image too large" }, { status: 400 });
    data.imageUrl = img;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  // Update ingredients if provided
  const ingredients: { ingredientId: string; quantityPerPortion: number }[] | undefined =
    Array.isArray(body.ingredients) ? body.ingredients : undefined;

  const item = await prisma.$transaction(
    async (tx) => {
    if (ingredients) {
      // Replace all ingredients
      await tx.menuItemIngredient.deleteMany({ where: { menuItemId: id } });
      if (ingredients.length > 0) {
        await tx.menuItemIngredient.createMany({
          data: ingredients.map((i) => ({
            menuItemId: id,
            ingredientId: i.ingredientId,
            quantityPerPortion: i.quantityPerPortion || 0,
          })),
        });
      }
    }

    return tx.menuItem.update({
      where: { id },
      data,
      include: {
        ingredients: { include: { ingredient: { select: { name: true, unit: true } } } },
      },
    });
  },
  { maxWait: 5000, timeout: 20000 }
);

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
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });

  // Check if item has orders — if so, soft-delete; otherwise hard-delete
  const orderCount = await prisma.orderItem.count({ where: { menuItemId: id } });

  if (orderCount > 0) {
    await prisma.menuItem.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, action: "soft-deleted" });
  }

  await prisma.menuItem.delete({ where: { id } });
  return NextResponse.json({ success: true, action: "hard-deleted" });
}
