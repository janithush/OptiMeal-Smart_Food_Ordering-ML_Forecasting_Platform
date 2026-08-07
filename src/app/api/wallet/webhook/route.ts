import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayHereWebhookSignature, extractUserIdFromOrderId } from "@/lib/payhere";
import { earnCoins } from "@/lib/coins";

/**
 * POST /api/wallet/webhook — PayHere server-to-server callback.
 * NO JWT AUTH — PayHere is an external third-party server.
 * Security: HMAC-MD5 signature validation only (AD-7).
 * Idempotency: order_id as unique key (AD-3, NFR-10).
 */
export async function POST(req: NextRequest) {
  const body = await req.formData();

  const orderId = body.get("order_id")?.toString() ?? "";
  const payhereAmount = parseFloat(body.get("payhere_amount")?.toString() ?? "0");
  const payhereCurrency = body.get("payhere_currency")?.toString() ?? "LKR";
  const statusCode = body.get("status_code")?.toString() ?? "";
  const md5sig = body.get("md5sig")?.toString() ?? "";

  console.log(`[webhook] Received: order_id=${orderId} amount=${payhereAmount} status=${statusCode}`);

  // ── HMAC signature verification (webhook-specific formula) ──────
  const valid = verifyPayHereWebhookSignature(
    orderId,
    payhereAmount.toFixed(2),
    payhereCurrency,
    statusCode,
    md5sig
  );

  if (!valid) {
    console.warn(`[webhook] Invalid HMAC for order ${orderId}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`[webhook] HMAC valid for order ${orderId}`);

  // ── Only process successful payments (status_code === "2") ──────
  if (statusCode !== "2") {
    console.log(`[webhook] Non-success status ${statusCode} for order ${orderId} — acknowledged`);
    return NextResponse.json({ status: "acknowledged" });
  }

  // ── Extract userId from order_id ────────────────────────────────
  const userId = extractUserIdFromOrderId(orderId);
  if (!userId) {
    console.warn(`[webhook] Cannot extract userId from order ${orderId}`);
    return NextResponse.json({ error: "Invalid order_id format" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Idempotency check (AD-3, NFR-10)
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: orderId },
      });
      if (existing) {
        console.log(`[webhook] Order ${orderId} already processed — idempotent`);
        return;
      }

      // Get or create wallet
      let wallet = await tx.walletAccount.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.walletAccount.create({ data: { userId } });
      }

      // Compute running balance
      const agg = await tx.walletTransaction.aggregate({
        where: { walletId: wallet.id },
        _sum: { amount: true },
      });
      const currentBalance = Number(agg._sum.amount ?? 0);
      const newBalance = currentBalance + payhereAmount;

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "TOP_UP",
          amount: payhereAmount,
          idempotencyKey: orderId,
          payHereRef: orderId,
          runningBalance: newBalance,
        },
      });

      console.log(`[webhook] Credited LKR ${payhereAmount} to user ${userId} | balance: LKR ${newBalance}`);

      // Story 4.3: Earn Coins on top-up (1 Coin/LKR 100)
      const earned = await earnCoins(tx, userId, payhereAmount, "WALLET_TOP_UP");
      if (earned > 0) console.log(`[webhook] Earned ${earned} coins for user ${userId}`);
    });

    return NextResponse.json({ status: "credited" });
  } catch (e) {
    // P2002 = idempotency key conflict (race condition — already processed)
    if ((e as { code?: string })?.code === "P2002") {
      console.log(`[webhook] Order ${orderId} duplicate (P2002) — idempotent`);
      return NextResponse.json({ status: "already_processed" });
    }
    console.error("[webhook] Error processing payment:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
