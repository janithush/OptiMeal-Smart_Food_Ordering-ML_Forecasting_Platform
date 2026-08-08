import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/admin/ingredients/[id] — Rename or change unit of an ingredient
 * DELETE /api/admin/ingredients/[id] — Soft-delete (set isActive = false)
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

  const name = body.name ? String(body.name).trim() : undefined;
  const unit = body.unit ? String(body.unit).trim() : undefined;

  if (!name && !unit) {
    return NextResponse.json(
      { error: "At least one of name or unit is required" },
      { status: 400 }
    );
  }

  // Check ingredient exists
  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
  }

  const updateData: { name?: string; unit?: string } = {};
  if (name) updateData.name = name;
  if (unit) updateData.unit = unit;

  const updated = await prisma.ingredient.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, unit: true, isActive: true },
  });

  return NextResponse.json({ ingredient: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;

  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
  }

  // Soft-delete: set isActive = false
  await prisma.ingredient.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
