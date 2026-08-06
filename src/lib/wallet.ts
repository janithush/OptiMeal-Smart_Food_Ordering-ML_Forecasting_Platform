import { prisma } from "./prisma";

/**
 * Get or create the wallet for a user.
 * On first access, creates the WalletAccount and seeds LKR 2,000.
 */
export async function getOrCreateWallet(userId: string) {
  const existing = await prisma.walletAccount.findUnique({
    where: { userId },
  });

  if (existing) {
    const balance = await getWalletBalance(existing.id);
    return { wallet: existing, balance };
  }

  // Create wallet + seed balance
  const wallet = await prisma.walletAccount.create({
    data: { userId },
  });

  // Seed LKR 2,000 TOP_UP for demo
  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "TOP_UP",
      amount: 2000,
      idempotencyKey: `SEED-${userId}`,
      runningBalance: 2000,
    },
  });

  return { wallet, balance: 2000 };
}

/**
 * Compute current balance as SUM(amount) from the append-only log.
 * AD-3: balance is never stored as a mutable scalar on WalletAccount.
 */
export async function getWalletBalance(walletId: string): Promise<number> {
  const result = await prisma.walletTransaction.aggregate({
    where: { walletId },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

/**
 * Get all transactions for a wallet, newest first.
 */
export async function getTransactions(walletId: string) {
  const txs = await prisma.walletTransaction.findMany({
    where: { walletId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      amount: true,
      runningBalance: true,
      createdAt: true,
      orderId: true,
      payHereRef: true,
    },
  });

  return txs.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount),
    runningBalance: Number(tx.runningBalance),
    createdAt: tx.createdAt.toISOString(),
    orderId: tx.orderId ?? null,
    payHereRef: tx.payHereRef ?? null,
  }));
}
