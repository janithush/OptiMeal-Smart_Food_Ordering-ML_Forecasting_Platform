import { verifyApiAuth } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { buildPayHereFormData } from "@/lib/payhere";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/student/wallet/topup — initiate PayHere top-up.
 * Returns form data for the frontend to auto-submit to PayHere.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const amount = Number(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 100) {
    return NextResponse.json({ error: "Minimum top-up amount is LKR 100" }, { status: 400 });
  }
  if (amount > 50000) {
    return NextResponse.json({ error: "Maximum top-up amount is LKR 50,000" }, { status: 400 });
  }

  // Fetch user details for PayHere form
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, phone: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const formData = buildPayHereFormData(amount, session.user.id, user.email, user.name ?? "", user.phone);

  // Debug: log what's being sent to PayHere
  console.log("[topup] PayHere form payload:", JSON.stringify(formData, null, 2));

  return NextResponse.json(formData);
}
