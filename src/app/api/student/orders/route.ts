import { verifyApiAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { toDisplayLabel } from "@/lib/slots";
import { earnCoins, redeemCoins } from "@/lib/coins";

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
  const coinsRedeemed = Math.max(0, Math.min(100, Number(body.coinsRedeemed ?? 0) || 0));
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

      // ═══ Story 4.1: Real wallet deduction ══════════════════════════
      // Get or create wallet
      let wallet = await tx.walletAccount.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.walletAccount.create({ data: { userId } });
        // Seed LKR 2,000 for demo
        await tx.walletTransaction.create({
          data: { walletId: wallet.id, type: "TOP_UP", amount: 2000, idempotencyKey: `SEED-${userId}`, runningBalance: 2000 },
        });
      }

      // Lock wallet: compute current balance
      const agg = await tx.walletTransaction.aggregate({
        where: { walletId: wallet.id },
        _sum: { amount: true },
      });
      const currentBalance = Number(agg._sum.amount ?? 0);

      const netAmount = totalAmount - coinsRedeemed;
      if (currentBalance < netAmount) throw new Error("INSUFFICIENT_FUNDS");

      // Story 4.3: Redeem coins if requested (FIFO batch deduction)
      let actualRedeemed = 0;
      if (coinsRedeemed > 0) {
        actualRedeemed = await redeemCoins(tx, userId, coinsRedeemed);
        if (actualRedeemed > 0) {
          // Create COINS_REDEMPTION transaction (credits back to balance offset)
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: "COINS_REDEMPTION",
              amount: -actualRedeemed,
              idempotencyKey: `coins-${orderType === "PRE_ORDER" && pickupSlotId ? `order-${userId}-${pickupSlotId}` : `order-${userId}-walkin`}-${Date.now()}`,
              runningBalance: currentBalance - netAmount - actualRedeemed,
            },
          });
        }
      }

      const newBalance = currentBalance - netAmount;
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "ORDER_DEDUCTION",
          amount: -netAmount,
          idempotencyKey: orderType === "PRE_ORDER" && pickupSlotId
            ? `order-${userId}-${pickupSlotId}-${Date.now()}`
            : `order-${userId}-walkin-${Date.now()}`,
          runningBalance: newBalance,
        },
      });

      // Story 4.3: Earn Coins on pre-order (2 Coins/LKR 100). Walk-in = 0.
      if (orderType === "PRE_ORDER") {
        await earnCoins(tx, userId, totalAmount, "PRE_ORDER_SPEND", orderType);
      }

      // ═══ Create Order ═════════════════════════════════════════════
      const orderNumber = generateOrderNumber();
      const { randomUUID } = await import("node:crypto");

      return tx.order.create({
        data: {
          orderNumber,
          studentId: userId,
          type: orderType as "PRE_ORDER" | "WALK_IN",
          pickupSlotId: orderType === "PRE_ORDER" ? pickupSlotId : null,
          totalAmount,
          coinsRedeemed: actualRedeemed,
          discountAmount: actualRedeemed,
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
      if (e.message === "INSUFFICIENT_FUNDS") return NextResponse.json({ error: "Insufficient balance. Please top up your wallet." }, { status: 402 });
      console.error("[orders] unexpected error:", e.message, e.stack);
      return NextResponse.json({ error: "Server error: " + e.message }, { status: 500 });
    }
    throw e;
  }
}
