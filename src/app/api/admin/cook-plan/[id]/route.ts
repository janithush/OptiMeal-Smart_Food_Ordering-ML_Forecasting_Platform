import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { isCookPlanLocked } from "@/lib/cook-plan";

/**
 * PATCH /api/admin/cook-plan/[id] — Update a single CookPlanItem's finalQty.
 *
 * Enforces AD-9 lock lifecycle:
 * - SUGGESTED: simple update
 * - CONFIRMED before 10 AM: simple update
 * - CONFIRMED after 10 AM: requires override=true → SUPERSEDE old, create new
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

  const finalQty = Number(body.finalQty);
  if (Number.isNaN(finalQty) || finalQty < 0) {
    return NextResponse.json({ error: "finalQty must be a non-negative integer" }, { status: 400 });
  }

  const existing = await prisma.cookPlanItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Cook Plan item not found" }, { status: 404 });
  }

  // AD-9: Lock enforcement
  if (existing.status === "CONFIRMED" && isCookPlanLocked(existing.status)) {
    const override = body.override === true;
    if (!override) {
      return NextResponse.json(
        {
          error: "Locked",
          message: "This Cook Plan is locked (confirmed after 10:00 AM). Set override=true to supersede.",
        },
        { status: 400 }
      );
    }

    // Override: SUPERSEDE old → create new
    await prisma.cookPlanItem.update({
      where: { id },
      data: { status: "SUPERSEDED" },
    });

    const newItem = await prisma.cookPlanItem.create({
      data: {
        date: existing.date,
        menuItemId: existing.menuItemId,
        forecastQty: existing.forecastQty,
        preOrderQty: existing.preOrderQty,
        finalQty,
        bufferQty: existing.bufferQty,
        adminAdjusted: true,
        status: "SUPERSEDED",
        supersededById: existing.id,
      },
    });

    return NextResponse.json({
      item: {
        id: newItem.id,
        finalQty: newItem.finalQty,
        adminAdjusted: newItem.adminAdjusted,
        status: newItem.status,
        supersededById: newItem.supersededById,
      },
    });
  }

  // Simple update (SUGGESTED, or CONFIRMED before 10 AM)
  const updated = await prisma.cookPlanItem.update({
    where: { id },
    data: { finalQty, adminAdjusted: true },
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      finalQty: updated.finalQty,
      adminAdjusted: updated.adminAdjusted,
      status: updated.status,
    },
  });
}
