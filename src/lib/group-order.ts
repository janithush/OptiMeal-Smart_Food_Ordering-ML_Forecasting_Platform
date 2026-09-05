import { prisma } from "./prisma";
import { toDisplayLabel } from "./slots";
import { getOrCreateWallet } from "./wallet";
import { earnCoins, redeemCoins } from "./coins";
import type {
  GroupOrderData,
  GroupParticipantData,
  GroupCartItemData,
  GroupOrderCheckoutResult,
} from "@/types/group-order";

// ─── Code generation ──────────────────────────────────────────────

/** Generate a 6-char uppercase alphanumeric code */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** Generate a unique order number */
function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  return `#GRP-${date}-${suffix}`;
}

// ─── Create ───────────────────────────────────────────────────────

export async function createGroupOrder(organizerId: string): Promise<GroupOrderData> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  // Generate unique code (retry on collision)
  let code = generateCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await prisma.groupOrder.findUnique({ where: { code } });
    if (!existing) break;
    code = generateCode();
    attempts++;
  }

  const group = await prisma.groupOrder.create({
    data: {
      code,
      organizerId,
      status: "OPEN",
      expiresAt,
      participants: {
        create: { studentId: organizerId },
      },
    },
    include: {
      participants: { include: { student: { select: { name: true } } } },
      cartItems: {
        include: {
          participant: { select: { name: true } },
          menuItem: {
            select: { id: true, name: true, basePrice: true, dietaryType: true, imageUrl: true },
          },
        },
      },
    },
  });

  const organizer = group.participants.find((p) => p.studentId === organizerId)!;

  return {
    id: group.id,
    code: group.code,
    organizerId: group.organizerId,
    organizerName: organizer.student.name,
    status: group.status,
    pickupSlotId: group.pickupSlotId,
    expiresAt: group.expiresAt.toISOString(),
    createdAt: group.createdAt.toISOString(),
    participants: group.participants.map((p) => ({
      id: p.id,
      studentId: p.studentId,
      studentName: p.student.name,
      joinedAt: p.joinedAt.toISOString(),
    })),
    cartItems: group.cartItems.map((ci) => ({
      id: ci.id,
      participantId: ci.participantId,
      participantName: ci.participant.name,
      menuItemId: ci.menuItemId,
      menuItemName: ci.menuItem.name,
      quantity: ci.quantity,
      basePrice: Number(ci.menuItem.basePrice),
      dietaryType: ci.menuItem.dietaryType,
      imageUrl: ci.menuItem.imageUrl,
    })),
  };
}

// ─── Join ─────────────────────────────────────────────────────────

export async function joinGroupOrder(
  code: string,
  userId: string
): Promise<GroupOrderData> {
  const group = await prisma.groupOrder.findUnique({
    where: { code },
    include: {
      participants: true,
    },
  });

  if (!group) throw new Error("Invalid group code");
  if (group.status !== "OPEN") throw new Error("This group order has ended");
  if (new Date() > group.expiresAt) {
    // Auto-expire
    await prisma.groupOrder.update({
      where: { id: group.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("This group order has expired");
  }
  if (group.participants.length >= 6) throw new Error("Group is full (max 6 people)");
  if (group.participants.some((p) => p.studentId === userId)) {
    throw new Error("You are already in this group");
  }

  await prisma.groupOrderParticipant.create({
    data: {
      groupOrderId: group.id,
      studentId: userId,
    },
  });

  return getGroupOrder(group.id);
}

// ─── Get ──────────────────────────────────────────────────────────

export async function getGroupOrder(groupOrderId: string): Promise<GroupOrderData> {
  const group = await prisma.groupOrder.findUnique({
    where: { id: groupOrderId },
    include: {
      participants: {
        include: { student: { select: { name: true } } },
        orderBy: { joinedAt: "asc" },
      },
      cartItems: {
        include: {
          participant: { select: { name: true } },
          menuItem: {
            select: { id: true, name: true, basePrice: true, dietaryType: true, imageUrl: true },
          },
        },
        orderBy: { addedAt: "asc" },
      },
    },
  });

  if (!group) throw new Error("Group order not found");

  return {
    id: group.id,
    code: group.code,
    organizerId: group.organizerId,
    organizerName: group.participants.find((p) => p.studentId === group.organizerId)?.student.name ?? "Unknown",
    status: group.status,
    pickupSlotId: group.pickupSlotId,
    expiresAt: group.expiresAt.toISOString(),
    createdAt: group.createdAt.toISOString(),
    participants: group.participants.map((p) => ({
      id: p.id,
      studentId: p.studentId,
      studentName: p.student.name,
      joinedAt: p.joinedAt.toISOString(),
    })),
    cartItems: group.cartItems.map((ci) => ({
      id: ci.id,
      participantId: ci.participantId,
      participantName: ci.participant.name,
      menuItemId: ci.menuItemId,
      menuItemName: ci.menuItem.name,
      quantity: ci.quantity,
      basePrice: Number(ci.menuItem.basePrice),
      dietaryType: ci.menuItem.dietaryType,
      imageUrl: ci.menuItem.imageUrl,
    })),
  };
}

// ─── Cart Items ──────────────────────────────────────────────────

export async function addItemToGroupCart(
  groupOrderId: string,
  userId: string,
  menuItemId: string,
  quantity: number
): Promise<GroupOrderData> {
  const group = await prisma.groupOrder.findUnique({
    where: { id: groupOrderId },
    select: { id: true, status: true, expiresAt: true, participants: true },
  });

  if (!group) throw new Error("Group order not found");
  if (group.status !== "OPEN") throw new Error("This group order has ended");
  if (new Date() > group.expiresAt) throw new Error("This group order has expired");
  if (!group.participants.some((p) => p.studentId === userId)) {
    throw new Error("You are not a participant in this group");
  }

  // Upsert — add or update quantity
  await prisma.groupOrderCartItem.upsert({
    where: {
      groupOrderId_participantId_menuItemId: {
        groupOrderId,
        participantId: userId,
        menuItemId,
      },
    },
    update: { quantity: { increment: quantity } },
    create: {
      groupOrderId,
      participantId: userId,
      menuItemId,
      quantity,
    },
  });

  return getGroupOrder(groupOrderId);
}

export async function removeGroupCartItem(
  groupOrderId: string,
  userId: string,
  cartItemId: string
): Promise<GroupOrderData> {
  const item = await prisma.groupOrderCartItem.findUnique({
    where: { id: cartItemId },
    select: { participantId: true, groupOrderId: true },
  });

  if (!item || item.groupOrderId !== groupOrderId) {
    throw new Error("Cart item not found");
  }
  if (item.participantId !== userId) {
    throw new Error("You can only remove your own items");
  }

  await prisma.groupOrderCartItem.delete({ where: { id: cartItemId } });

  return getGroupOrder(groupOrderId);
}

// ─── Checkout ─────────────────────────────────────────────────────

type CheckoutLineItem = { menuItemId: string; quantity: number; unitPrice: number };

export async function checkoutGroupOrder(
  groupOrderId: string,
  organizerId: string,
  pickupSlotId: string,
  coinsRedeemed: number,
  idempotencyKey: string
): Promise<GroupOrderCheckoutResult> {
  const group = await prisma.groupOrder.findUnique({
    where: { id: groupOrderId },
    include: {
      participants: {
        include: { student: { select: { name: true } } },
      },
      cartItems: {
        include: {
          menuItem: { select: { id: true, basePrice: true, isActive: true } },
          participant: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!group) throw new Error("Group order not found");
  if (group.organizerId !== organizerId) throw new Error("Only the organiser can checkout");
  if (group.status !== "OPEN") throw new Error("Group order is not open");
  if (new Date() > group.expiresAt) throw new Error("Group order has expired");

  // Group items by participant
  const participantItems = new Map<string, CheckoutLineItem[]>();
  for (const ci of group.cartItems) {
    if (!ci.menuItem.isActive) continue;
    const items = participantItems.get(ci.participantId) ?? [];
    items.push({
      menuItemId: ci.menuItemId,
      quantity: ci.quantity,
      unitPrice: Number(ci.menuItem.basePrice),
    });
    participantItems.set(ci.participantId, items);
  }

  if (participantItems.size === 0) throw new Error("Cart is empty");

  const totalAmount = [...participantItems.values()]
    .flat()
    .reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  coinsRedeemed = Math.max(0, Math.min(100, Math.floor(coinsRedeemed)));

  // Idempotency: a replay with the same client key must never double-charge.
  // The key is namespaced so it can never collide with single-order keys.
  const txKey = `grp-${idempotencyKey}`;
  const replay = await prisma.walletTransaction.findUnique({
    where: { idempotencyKey: txKey },
    select: { id: true },
  });
  if (replay) throw new Error("DUPLICATE_SUBMISSION");

  const result = await prisma.$transaction(async (tx) => {
    // Validate & increment slot
    const slot = await tx.pickupSlot.findUnique({
      where: { id: pickupSlotId },
      select: { currentCount: true, maxCapacity: true, slotTime: true },
    });
    if (!slot) throw new Error("Pickup slot not found");
    if (slot.currentCount >= slot.maxCapacity) throw new Error("Pickup slot is full");

    await tx.pickupSlot.update({
      where: { id: pickupSlotId },
      data: { currentCount: { increment: participantItems.size } },
    });

    // Wallet deduction (organiser only)
    const { balance: currentBalance } = await getOrCreateWallet(organizerId);
    const netAmount = totalAmount - coinsRedeemed;
    if (currentBalance < netAmount) throw new Error("Insufficient wallet balance");

    // Redeem coins if requested
    let actualRedeemed = 0;
    if (coinsRedeemed > 0) {
      actualRedeemed = await redeemCoins(tx, organizerId, coinsRedeemed);
    }

    // Deduct from wallet
    const wallet = (await tx.walletAccount.findUnique({ where: { userId: organizerId } }))!;
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "ORDER_DEDUCTION",
        amount: -(netAmount - actualRedeemed),
        // Stable client-supplied key → P2002 on racing duplicates.
        idempotencyKey: txKey,
        runningBalance: currentBalance - netAmount,
      },
    });

    // Earn coins for organiser (2 per LKR 100)
    await earnCoins(tx, organizerId, totalAmount, "PRE_ORDER_SPEND", "PRE_ORDER");

    // Create individual Orders per participant
    const orderResults: { orderId: string; orderNumber: string; studentName: string; itemCount: number }[] = [];
    const qrCode = generateOrderNumber();

    for (const [participantId, items] of participantItems) {
      const participant = group.participants.find(
        (p) => p.studentId === participantId
      );
      const orderNumber = generateOrderNumber();
      const orderTotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

      const order = await tx.order.create({
        data: {
          orderNumber,
          studentId: participantId,
          type: "PRE_ORDER",
          status: "CONFIRMED",
          pickupSlotId,
          totalAmount: orderTotal,
          coinsRedeemed: 0,
          discountAmount: 0,
          qrCode,
          groupOrderId,
          items: {
            create: items.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              subtotal: i.quantity * i.unitPrice,
            })),
          },
        },
      });

      orderResults.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        studentName: participant?.student.name ?? "Unknown",
        itemCount: items.length,
      });
    }

    // Lock the group
    await tx.groupOrder.update({
      where: { id: groupOrderId },
      data: { status: "CONFIRMED", pickupSlotId },
    });

    return {
      orders: orderResults,
      totalAmount,
      qrCode,
      pickupSlot: {
        slotTime: slot.slotTime,
        displayLabel: toDisplayLabel(slot.slotTime),
      },
    };
  });

  return result;
}
