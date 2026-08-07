import { verifyApiAuth } from "@/lib/api-auth";
import { createGroupOrder } from "@/lib/group-order";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/student/group-orders — Create a new group order
 */
export async function POST(_req: NextRequest) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  try {
    const group = await createGroupOrder(session.user.id);
    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create group order";
    if (message.includes("Invalid")) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
