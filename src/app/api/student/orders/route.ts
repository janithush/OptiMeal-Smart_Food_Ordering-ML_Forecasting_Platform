import { verifyApiAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { toDisplayLabel } from "@/lib/slots";

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  return `#CAF-${date}-${suffix}`;
}

type OrderItemInput = { menuItemId: string; quantity: number; unitPrice: number };

/**
 * POST /api/student/orders
 */
export async function POST(req: NextRequest) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const userId = session.user.id;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const orderType = String(body.orderType ?? "");
  const pickupSlotId = body.pickupSlotId ?? null;
  const lineItems: OrderItemInput[] = Array.isArray(body.items) ? body.items : [];

  // Validation
  if (lineItems.length === 0) {
    return NextResponse.json({ error: "No items in order" }, { status: 400 });
  }
  if (!["PRE_ORDER", "WALK_IN"].includes(orderType)) {
    return NextResponse.json({ error: "Invalid order type" }, { status: 400 });
  }
  if (orderType === "PRE_ORDER" && !pickupSlotId) {
    return NextResponse.json({ error: "Pickup slot required for pre-order" }, { status: 400 });
  }

  const totalAmount = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Pre-order: validate & increment slot
      if (orderType === "PRE_ORDER" && pickupSlotId) {
        const slot = await tx.pickupSlot.findUnique({
          where: { id: pickupSlotId },
          select: { currentCount: true, maxCapacity: true },
        });
        if (!slot) throw new Error("SLOT_NOT_FOUND");
        if (slot.currentCount >= slot.maxCapacity) throw new Error("SLOT_FULL");

        await tx.pickupSlot.update({
          where: { id: pickupSlotId },
          data: { currentCount: { increment: 1 } },
        });
      }

      const orderNumber = generateOrderNumber();
      const { randomUUID } = await import("node:crypto");

      return tx.order.create({
        data: {
          orderNumber,
          studentId: userId,
          type: orderType as "PRE_ORDER" | "WALK_IN",
          pickupSlotId: orderType === "PRE_ORDER" ? pickupSlotId : null,
          totalAmount,
          qrCode: `CAF-SMART-${randomUUID()}`,
          items: {
            create: lineItems.map((li) => ({
              menuItemId: li.menuItemId,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              subtotal: li.quantity * li.unitPrice,
            })),
          },
        },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
          pickupSlot: { select: { slotTime: true } },
        },
      });
    });

    console.log(`[WALLET-MOCK] Order ${order.orderNumber}: LKR ${totalAmount} would be deducted`);

    return NextResponse.json(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        type: order.type,
        status: order.status,
        pickupSlot: order.pickupSlot
          ? { slotTime: order.pickupSlot.slotTime, displayLabel: toDisplayLabel(order.pickupSlot.slotTime) }
          : null,
        totalAmount: Number(order.totalAmount),
        qrCode: order.qrCode,
        items: order.items.map((oi) => ({
          menuItemName: oi.menuItem.name,
          quantity: oi.quantity,
          unitPrice: Number(oi.unitPrice),
          subtotal: Number(oi.subtotal),
        })),
        createdAt: order.createdAt,
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "SLOT_FULL") return NextResponse.json({ error: "Slot is no longer available" }, { status: 409 });
      if (e.message === "SLOT_NOT_FOUND") return NextResponse.json({ error: "Slot not found" }, { status: 404 });
      console.error("[orders] unexpected error:", e.message, e.stack);
      return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
    }
    throw e;
  }
}
