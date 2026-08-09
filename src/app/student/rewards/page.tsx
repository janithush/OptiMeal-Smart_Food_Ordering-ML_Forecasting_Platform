import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCoinsBalance, getCoinBatches, getExpiringBatches } from "@/lib/coins";
import RewardsPageContent from "./RewardsPageContent";

export default async function RewardsPage() {
  const session = await requireAuth();
  if (session.user.role !== "STUDENT") redirect("/forbidden");

  const [balance, batches, expiringBatches] = await Promise.all([
    getCoinsBalance(prisma, session.user.id),
    getCoinBatches(prisma, session.user.id),
    getExpiringBatches(prisma, session.user.id, 7),
  ]);

  return (
    <RewardsPageContent
      balance={balance}
      batches={batches.map((b) => ({
        id: b.id,
        earned: b.earned,
        redeemed: b.redeemed,
        source: b.source,
        earnedAt: b.earnedAt.toISOString(),
        expiresAt: b.expiresAt.toISOString(),
      }))}
      expiringBatches={expiringBatches.map((b) => ({
        id: b.id,
        earned: b.earned,
        redeemed: b.redeemed,
        source: b.source,
        earnedAt: b.earnedAt.toISOString(),
        expiresAt: b.expiresAt.toISOString(),
      }))}
    />
  );
}
