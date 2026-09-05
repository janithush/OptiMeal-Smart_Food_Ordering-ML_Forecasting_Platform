import { verifyApiAuth } from "@/lib/api-auth";
import { checkoutGroupOrder } from "@/lib/group-order";
import { NextRequest, NextResponse } from "next/server";
import { groupCheckoutSchema } from "@/lib/validation/schemas";

/**
 * POST /api/student/group-orders/[id]/checkout — Organiser checkout
 * Zod-validated; client idempotencyKey dedupes double submits (409, no charge).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = groupCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const result = await checkoutGroupOrder(
      id,
      session.user.id,
      parsed.data.pickupSlotId,
      parsed.data.coinsRedeemed,
      parsed.data.idempotencyKey
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    if (message === "DUPLICATE_SUBMISSION") {
      return NextResponse.json(
        { error: "Duplicate submission — checkout already processed", duplicate: true },
        { status: 409 }
      );
    }
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "Duplicate submission — checkout already processed", duplicate: true },
        { status: 409 }
      );
    }
    if (message.includes("not found")) return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
