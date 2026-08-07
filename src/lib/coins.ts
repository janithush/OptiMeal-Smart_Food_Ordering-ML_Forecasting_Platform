import type { Prisma } from "@prisma/client";

type TxClient = Omit<Prisma.TransactionClient, "$transaction">;

/**
 * Compute available Coins balance: SUM(earned - redeemed) for non-expired batches.
 * AD-10: Always use this function — never compute inline.
 */
export async function getCoinsBalance(
  tx: TxClient,
  userId: string
): Promise<number> {
  const result = await tx.coinBatch.aggregate({
    where: {
      userId,
      expired: false,
      expiresAt: { gt: new Date() },
    },
    _sum: { earned: true, redeemed: true },
  });
  return (result._sum.earned ?? 0) - (result._sum.redeemed ?? 0);
}

/**
 * Earn Coins on a top-up or pre-order.
 * FR-15: Top-Up = 1 Coin/LKR 100, Pre-Order = 2 Coins/LKR 100, rounded down.
 * Walk-In orders do NOT call this (0 Coins).
 */
export async function earnCoins(
  tx: TxClient,
  userId: string,
  amountLKR: number,
  source: "WALLET_TOP_UP" | "PRE_ORDER_SPEND",
  orderId?: string
) {
  const multiplier = source === "PRE_ORDER_SPEND" ? 2 : 1;
  const coins = Math.floor(amountLKR / 100) * multiplier;
  if (coins <= 0) return 0;

  await tx.coinBatch.create({
    data: {
      userId,
      earned: coins,
      source,
      orderId: orderId ?? null,
      earnedAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  return coins;
}

/**
 * Redeem Coins from earliest-expiring batches first (FIFO per AD-10).
 * Deducts `coinsToRedeem` across batches. Returns number actually redeemed.
 */
export async function redeemCoins(
  tx: TxClient,
  userId: string,
  coinsToRedeem: number
): Promise<number> {
  let remaining = coinsToRedeem;

  const batches = await tx.coinBatch.findMany({
    where: {
      userId,
      expired: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "asc" },
    select: { id: true, earned: true, redeemed: true },
  });

  let deducted = 0;
  for (const batch of batches) {
    const available = batch.earned - batch.redeemed;
    if (available <= 0) continue;
    const toDeduct = Math.min(available, remaining);
    await tx.coinBatch.update({
      where: { id: batch.id },
      data: { redeemed: { increment: toDeduct } },
    });
    remaining -= toDeduct;
    deducted += toDeduct;
    if (remaining <= 0) break;
  }

  return deducted;
}

/**
 * Get all non-expired coin batches for a user.
 */
export async function getCoinBatches(tx: TxClient, userId: string) {
  return tx.coinBatch.findMany({
    where: { userId, expired: false, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "asc" },
    select: {
      id: true, earned: true, redeemed: true, source: true,
      orderId: true, earnedAt: true, expiresAt: true,
    },
  });
}

/**
 * Get batches expiring within N days (for 7-day warning).
 */
export async function getExpiringBatches(
  tx: TxClient,
  userId: string,
  withinDays: number
) {
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  return tx.coinBatch.findMany({
    where: {
      userId,
      expired: false,
      expiresAt: { lte: cutoff, gt: new Date() },
    },
    orderBy: { expiresAt: "asc" },
    select: {
      id: true, earned: true, redeemed: true, source: true,
      expiresAt: true, earnedAt: true,
    },
  });
}
