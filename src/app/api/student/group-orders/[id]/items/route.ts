import { verifyApiAuth } from "@/lib/api-auth";
import { addItemToGroupCart } from "@/lib/group-order";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/student/group-orders/[id]/items — Add item to shared cart
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const menuItemId = body?.menuItemId;
  const quantity = Math.max(1, Math.min(10, Number(body?.quantity ?? 1) || 1));

  if (!menuItemId) {
    return NextResponse.json({ error: "menuItemId is required" }, { status: 400 });
  }

  try {
    const group = await addItemToGroupCart(id, session.user.id, menuItemId, quantity);
    return NextResponse.json(group);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add item";
    if (message.includes("not found")) return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
