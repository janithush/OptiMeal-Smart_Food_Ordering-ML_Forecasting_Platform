import { verifyApiAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { toDisplayLabel } from "@/lib/slots";
import { earnCoins, redeemCoins } from "@/lib/coins";
import { emitDashboardRefresh } from "@/lib/order-events";
import { createOrderSchema } from "@/lib/validation/schemas";

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  return `#CAF-${date}-${suffix}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * POST /api/student/orders
 * Security: strict Zod validation, server-side re-pricing (client unitPrice
 * is NEVER trusted), client-supplied idempotencyKey, atomic transaction
 * with wallet row lock.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const userId = session.user.id;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { orderType, pickupSlotId, coinsRedeemed, flashDealId, items, idempotencyKey } =
    parsed.data;

  // Idempotency: return existing order if this key was already used.
  const existingTx = await prisma.walletTransaction.findUnique({
    where: { idempotencyKey: `order-${idempotencyKey}` },
    select: { orderId: true },
  });
  if (existingTx?.orderId) {
    const existing = await prisma.order.findUnique({
      where: { id: existingTx.orderId },
      include: {
        items: { include: { menuItem: { select: { name: true } } } },
        pickupSlot: { select: { slotTime: true } },
      },
    });
    if (existing) {
      return NextResponse.json(
        {
          id: existing.id,
          orderNumber: existing.orderNumber,
          deduped: true,
        },
        { status: 200 }
      );
    }
  }

  // ─── Server-side re-pricing: NEVER trust client unitPrice ───
  const menuItemIds = items.map((i) => i.menuItemId);
  const today = startOfToday();
  const dbItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, isActive: true },
    select: {
      id: true,
      basePrice: true,
      dailySpecials: {
        where: { date: today },
        select: { specialPrice: true },
        take: 1,
      },
    },
  });
  if (dbItems.length !== menuItemIds.length) {
    return NextResponse.json(
      { error: "One or more items are unavailable" },
      { status: 410 }
    );
  }
  const priceById = new Map(
    dbItems.map((m) => [
      m.id,
      m.dailySpecials[0] ? Number(m.dailySpecials[0].specialPrice) : Number(m.basePrice),
    ])
  );
  const pricedLines = items.map((li) => {
    const unitPrice = priceById.get(li.menuItemId)!;
    return {
      menuItemId: li.menuItemId,
      quantity: li.quantity,
      unitPrice,
      subtotal: Math.round(unitPrice * li.quantity * 100) / 100,
    };
  });
  const totalAmount = Math.round(pricedLines.reduce((s, l) => s + l.subtotal, 0) * 100) / 100;

  // Story 6.4: Validate Flash Deal if provided
  let flashDealDiscount = 0;
  if (flashDealId) {
    const deal = await prisma.flashDeal.findUnique({ where: { id: flashDealId } });
    if (!deal) {
      return NextResponse.json({ error: "Flash Deal not found" }, { status: 404 });
    }
    if (deal.cancelledAt || deal.expiresAt <= new Date()) {
      return NextResponse.json({ error: "Flash Deal has expired" }, { status: 410 });
    }
    const todayStart = startOfToday();
    const alreadyOrdered = await prisma.orderItem.findFirst({
      where: {
        menuItemId: deal.menuItemId,
        order: { studentId: userId, createdAt: { gte: todayStart } },
      },
    });
    if (alreadyOrdered) {
      return NextResponse.json({ error: "Already ordered this deal item today" }, { status: 409 });
    }
    const dealItem = pricedLines.find((li) => li.menuItemId === deal.menuItemId);
    if (dealItem) {
      const discountedPrice =
        Math.round(dealItem.unitPrice * (1 - deal.discountPercent / 100) * 100) / 100;
      flashDealDiscount =
        Math.round((dealItem.unitPrice - discountedPrice) * dealItem.quantity * 100) / 100;
    }
  }

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
      let wallet = await tx.walletAccount.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.walletAccount.create({ data: { userId } });
        await tx.walletTransaction.create({
          data: { walletId: wallet.id, type: "TOP_UP", amount: 2000, idempotencyKey: `SEED-${userId}`, runningBalance: 2000 },
        });
      } else {
        // Row-level lock: serialize concurrent order attempts for this wallet.
        await tx.$executeRaw`SELECT "id" FROM "WalletAccount" WHERE "id" = ${wallet.id} FOR UPDATE`;
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
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: "COINS_REDEMPTION",
              amount: -actualRedeemed,
              idempotencyKey: `coins-${idempotencyKey}`,
              runningBalance: currentBalance - netAmount - actualRedeemed,
            },
          });
        }
      }

      const newBalance = currentBalance - netAmount;
      const deduction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "ORDER_DEDUCTION",
          amount: -netAmount,
          // Client-supplied key → true idempotency. P2002 = duplicate submit.
          idempotencyKey: `order-${idempotencyKey}`,
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

      const created = await tx.order.create({
        data: {
          orderNumber,
          studentId: userId,
          type: orderType as "PRE_ORDER" | "WALK_IN",
          pickupSlotId: orderType === "PRE_ORDER" ? pickupSlotId! : null,
          totalAmount,
          coinsRedeemed: actualRedeemed,
          discountAmount: actualRedeemed + flashDealDiscount,
          discountType: flashDealId ? "FLASH_DEAL" : coinsRedeemed > 0 ? "COINS" : "NONE",
          flashDealId: flashDealId ?? null,
          qrCode: `CAF-SMART-${randomUUID()}`,
          items: {
            create: pricedLines.map((li) => ({
              menuItemId: li.menuItemId,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              subtotal: li.subtotal,
            })),
          },
        },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
          pickupSlot: { select: { slotTime: true } },
        },
      });

      // Link deduction → order for idempotent replay lookup.
      await tx.walletTransaction.update({
        where: { id: deduction.id },
        data: { orderId: created.id },
      });

      return created;
    });

    // Story 6.1: Emit live dashboard update to admin sockets
    emitDashboardRefresh().catch((err) => console.error("[orders] dashboard refresh failed:", err));

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
      // Prisma unique violation on idempotencyKey → treat as duplicate submit.
      const prismaErr = e as { code?: string };
      if (prismaErr.code === "P2002") {
        return NextResponse.json({ error: "Duplicate submission — order already placed" }, { status: 409 });
      }
      console.error("[orders] unexpected error:", e.message, e.stack);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    throw e;
  }
}
