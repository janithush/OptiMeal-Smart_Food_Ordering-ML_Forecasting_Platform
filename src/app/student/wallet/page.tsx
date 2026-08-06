import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet, getTransactions } from "@/lib/wallet";
import WalletPageContent from "./WalletPageContent";

export default async function WalletPage() {
  const session = await requireAuth();
  if (session.user.role !== "STUDENT") redirect("/forbidden");

  const { balance } = await getOrCreateWallet(session.user.id);
  const wallet = await prisma.walletAccount.findUnique({ where: { userId: session.user.id } });
  const transactions = wallet ? await getTransactions(wallet.id) : [];

  return <WalletPageContent balance={balance} transactions={transactions} />;
}
