import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/ingredients — List all ingredients
 * POST /api/admin/ingredients — Create new ingredient
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const ingredients = await prisma.ingredient.findMany({
    select: { id: true, name: true, unit: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ingredients });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const unit = String(body.unit ?? "kg").trim();

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const existing = await prisma.ingredient.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ ingredient: { id: existing.id, name: existing.name, unit: existing.unit } });
  }

  const ingredient = await prisma.ingredient.create({
    data: { name, unit },
    select: { id: true, name: true, unit: true },
  });

  return NextResponse.json({ ingredient }, { status: 201 });
}
