import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { menuItemUpdateSchema, validateImageUrl } from "@/lib/validation/images";

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

  const parsed = menuItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const v = parsed.data;

  const data: Record<string, unknown> = {};

  if (v.name !== undefined) data.name = v.name;
  if (v.description !== undefined) data.description = v.description;
  if (v.basePrice !== undefined) data.basePrice = v.basePrice;
  if (v.dietaryType !== undefined) data.dietaryType = v.dietaryType;
  if (v.imageUrl !== undefined) {
    const imgErr = validateImageUrl(v.imageUrl);
    if (imgErr) return NextResponse.json({ error: imgErr }, { status: 400 });
    data.imageUrl = v.imageUrl;
  }
  if (v.isActive !== undefined) data.isActive = v.isActive;

  // Update ingredients if provided
  const ingredients = v.ingredients;

  const item = await prisma
    .$transaction(
      async (tx) => {
    if (ingredients) {
      if (ingredients.length > 0) {
        const count = await tx.ingredient.count({
          where: { id: { in: ingredients.map((i) => i.ingredientId) }, isActive: true },
        });
        if (count !== ingredients.length) throw new Error("INVALID_INGREDIENTS");
      }
      // Replace all ingredients
      await tx.menuItemIngredient.deleteMany({ where: { menuItemId: id } });
      if (ingredients.length > 0) {
        await tx.menuItemIngredient.createMany({
          data: ingredients.map((i) => ({
            menuItemId: id,
            ingredientId: i.ingredientId,
            quantityPerPortion: i.quantityPerPortion,
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
    )
    .catch((e: unknown) => {
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
