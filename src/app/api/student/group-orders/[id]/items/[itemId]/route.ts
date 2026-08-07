import { verifyApiAuth } from "@/lib/api-auth";
import { removeGroupCartItem } from "@/lib/group-order";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/student/group-orders/[id]/items/[itemId] — Remove item from shared cart
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const { id, itemId } = await params;

  try {
    const group = await removeGroupCartItem(id, session.user.id, itemId);
    return NextResponse.json(group);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove item";
    if (message.includes("not found")) return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
