import { verifyApiAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { getOrCreateWallet, getTransactions } from "@/lib/wallet";

/**
 * GET /api/student/wallet — returns balance + transaction history.
 */
export async function GET() {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const { wallet, balance } = await getOrCreateWallet(session.user.id);
  const transactions = await getTransactions(wallet.id);

  return NextResponse.json({ balance, transactions });
}
