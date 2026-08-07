import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/menu/[id]/daily-special — Create or update daily special for a menu item
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const specialPrice = Number(body.specialPrice ?? 0);
  const description = body.description ? String(body.description) : null;

  if (specialPrice <= 0) return NextResponse.json({ error: "Special price must be > 0" }, { status: 400 });

  // Verify menu item exists
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const special = await prisma.dailySpecial.upsert({
    where: { menuItemId_date: { menuItemId: id, date: today } },
    update: { specialPrice, description },
    create: { menuItemId: id, specialPrice, description, date: today },
  });

  return NextResponse.json({
    special: {
      id: special.id,
      menuItemId: special.menuItemId,
      specialPrice: Number(special.specialPrice),
      description: special.description,
      date: special.date.toISOString().slice(0, 10),
    },
  });
}

/**
 * DELETE /api/admin/menu/[id]/daily-special — Remove today's daily special
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dailySpecial.deleteMany({
    where: { menuItemId: id, date: today },
  });

  return NextResponse.json({ success: true });
}
