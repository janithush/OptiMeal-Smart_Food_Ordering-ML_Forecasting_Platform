import { verifyApiAuth } from "@/lib/api-auth";
import { checkoutGroupOrder } from "@/lib/group-order";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/student/group-orders/[id]/checkout — Organiser checkout
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const pickupSlotId = body?.pickupSlotId;
  const coinsRedeemed = Math.max(0, Math.min(100, Number(body?.coinsRedeemed ?? 0) || 0));

  if (!pickupSlotId) {
    return NextResponse.json({ error: "Pickup slot is required" }, { status: 400 });
  }

  try {
    const result = await checkoutGroupOrder(id, session.user.id, pickupSlotId, coinsRedeemed);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    if (message.includes("not found")) return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
