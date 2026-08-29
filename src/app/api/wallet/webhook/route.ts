import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseFormUrlEncoded,
  verifyPayHereWebhookRaw,
  extractUserIdFromOrderId,
} from "@/lib/payhere";
import { earnCoins } from "@/lib/coins";
import { emitDashboardRefresh } from "@/lib/order-events";

/**
 * POST /api/wallet/webhook — PayHere server-to-server callback.
 *
 * Security (AD-7):
 *   - HMAC-MD5 signature is verified over the **RAW** form body, NOT a
 *     re-serialised object. Re-serialising would change whitespace/order
 *     and cause every legitimate callback to fail.
 *
 * Idempotency (AD-3, NFR-10):
 *   - `WalletTransaction.idempotencyKey = order_id` is the unique key.
 *   - The running balance is computed inside the same transaction as
 *     the insert, AFTER the unique-key check, so two racing webhooks
 *     can never double-credit the same user.
 *
 * No JWT auth — PayHere is an external third-party server.
 */
export async function POST(req: NextRequest) {
  // ── 1. Read & parse raw body BEFORE any other work ───────────────
  const rawBody = await req.text();
  const params = parseFormUrlEncoded(rawBody);

  const orderId = params["order_id"] ?? "";
  const payhereAmountStr = params["payhere_amount"] ?? "0";
  const payhereCurrency = params["payhere_currency"] ?? "LKR";
  const merchantId = params["merchant_id"] ?? "";
  const statusCode = params["status_code"] ?? "";
  const md5sig = params["md5sig"] ?? "";

  console.log(
    `[webhook] Received: order_id=${orderId} amount=${payhereAmountStr} currency=${payhereCurrency} status=${statusCode}`
  );

  // ── 2. Validate env at request time (not at module load) ─────────
  if (!process.env.PAYHERE_MERCHANT_ID || !process.env.PAYHERE_MERCHANT_SECRET) {
    console.error("[webhook] PAYHERE_MERCHANT_ID or PAYHERE_MERCHANT_SECRET is not configured");
    return NextResponse.json(
      { error: "PayHere not configured" },
      { status: 500 }
    );
  }

  // ── 3. HMAC verification on the raw values from the form body ────
  const valid = verifyPayHereWebhookRaw(
    merchantId,
    orderId,
    payhereAmountStr,
    payhereCurrency,
    statusCode,
    md5sig
  );

  if (!valid) {
    console.warn(`[webhook] Invalid HMAC for order ${orderId}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`[webhook] HMAC valid for order ${orderId}`);

  // ── 4. Only process successful payments (status_code === "2") ────
  if (statusCode !== "2") {
    console.log(`[webhook] Non-success status ${statusCode} for order ${orderId} — acknowledged`);
    return NextResponse.json({ status: "acknowledged" });
  }

  // ── 5. Extract userId from order_id ──────────────────────────────
  const userId = extractUserIdFromOrderId(orderId);
  if (!userId) {
    console.warn(`[webhook] Cannot extract userId from order ${orderId}`);
    return NextResponse.json({ error: "Invalid order_id format" }, { status: 400 });
  }

  // ── 6. Parse and validate the amount ─────────────────────────────
  const payhereAmount = Number(payhereAmountStr);
  if (!Number.isFinite(payhereAmount) || payhereAmount <= 0) {
    console.warn(`[webhook] Invalid amount ${payhereAmountStr} for order ${orderId}`);
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // ── 7. Currency sanity check (PayHere sandbox only supports LKR) ─
  if (payhereCurrency !== "LKR") {
    console.warn(`[webhook] Unsupported currency ${payhereCurrency} for order ${orderId}`);
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
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
      const wallet = await tx.walletAccount.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });

      // Compute running balance INSIDE the transaction so concurrent
      // webhooks serialise on the wallet row.
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

      console.log(
        `[webhook] Credited LKR ${payhereAmount} to user ${userId} | balance: LKR ${newBalance}`
      );

      // Story 4.3: Earn Coins on top-up (1 Coin / LKR 100)
      const earned = await earnCoins(tx, userId, payhereAmount, "WALLET_TOP_UP");
      if (earned > 0) console.log(`[webhook] Earned ${earned} coins for user ${userId}`);
    });

    // Story 6.1: Emit live dashboard update (outside the transaction)
    emitDashboardRefresh().catch((err) =>
      console.error("[webhook] dashboard refresh failed:", err)
    );

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

