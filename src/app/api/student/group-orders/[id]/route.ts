import { verifyApiAuth } from "@/lib/api-auth";
import { getGroupOrder } from "@/lib/group-order";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/student/group-orders/[id] — Get group order details
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const group = await getGroupOrder(id);

    // Verify user is a participant
    if (!group.participants.some((p) => p.studentId === session.user.id)) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    return NextResponse.json(group);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Group order not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
