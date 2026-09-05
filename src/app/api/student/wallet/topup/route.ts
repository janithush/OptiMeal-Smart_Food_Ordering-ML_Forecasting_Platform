import { verifyApiAuth } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { buildPayHereFormData } from "@/lib/payhere";
import { prisma } from "@/lib/prisma";
import { walletTopupSchema } from "@/lib/validation/schemas";

/**
 * POST /api/student/wallet/topup — initiate PayHere top-up.
 * Strict Zod validation (amount 100–50,000). Returns form data for the
 * frontend to auto-submit to PayHere.
 *
 * NOTE: the PayHere `order_id` format (`CAF-TOPUP-{userId}-{ts}`) is FROZEN —
 * the webhook's `extractUserIdFromOrderId` and in-flight payments depend on
 * it. The client `idempotencyKey` is validated and logged for traceability
 * across the PayHere redirect; double-submit protection comes from the
 * client's loading guard (one PayHere session per attempt) plus the
 * webhook's order_id dedupe (one credit per payment).
 */
export async function POST(req: NextRequest) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = walletTopupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { amount, idempotencyKey } = parsed.data;

  // Fetch user details for PayHere form
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, phone: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const formData = buildPayHereFormData(amount, session.user.id, user.email, user.name ?? "", user.phone);

  if (idempotencyKey) {
    console.log(`[topup] init attempt=${idempotencyKey} user=${session.user.id} amount=${amount} order=${formData.fields.order_id}`);
  }

  return NextResponse.json({ ...formData, attemptKey: idempotencyKey ?? null });
}
