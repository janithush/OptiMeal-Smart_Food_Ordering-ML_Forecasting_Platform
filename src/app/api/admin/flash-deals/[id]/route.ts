import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { emitFlashDealCancelled } from "@/lib/order-events";

/**
 * DELETE /api/admin/flash-deals/[id]
 * Cancels an active Flash Deal early.
 * Emits flashDealCancelled to /student and /admin namespaces.
 * Story 6.4: Smart Discount Trigger & Flash Deals (FR-25)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const deal = await prisma.flashDeal.findUnique({ where: { id } });

    if (!deal) {
      return NextResponse.json(
        { error: "Flash Deal not found" },
        { status: 404 }
      );
    }

    if (deal.cancelledAt) {
      return NextResponse.json(
        { error: "Flash Deal is already cancelled" },
        { status: 409 }
      );
    }

    if (deal.expiresAt <= new Date()) {
      return NextResponse.json(
        { error: "Flash Deal has already expired and cannot be cancelled" },
        { status: 410 }
      );
    }

    // ── Cancel the deal ─────────────────────────────────────────
    const updated = await prisma.flashDeal.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });

    // ── Broadcast cancellation ──────────────────────────────────
    emitFlashDealCancelled(deal.id, deal.menuItemId);

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[flash-deals] DELETE failed:", err);
    return NextResponse.json(
      { error: "Failed to cancel flash deal" },
      { status: 500 }
    );
  }
}
