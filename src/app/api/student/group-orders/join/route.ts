import { verifyApiAuth } from "@/lib/api-auth";
import { joinGroupOrder } from "@/lib/group-order";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/student/group-orders/join — Join a group order by code
 */
export async function POST(req: NextRequest) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").toUpperCase().trim();

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "Please enter a valid 6-character code" }, { status: 400 });
  }

  try {
    const group = await joinGroupOrder(code, session.user.id);
    return NextResponse.json(group);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to join group";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
