import { NextRequest, NextResponse } from "next/server";
import { validateInvitationToken } from "@/lib/admin-management";

/**
 * GET /api/admin/invite/[token]
 *
 * Public endpoint. Returns the invitation details if the token is valid
 * (not expired, not accepted, not cancelled). Returns 404 if invalid.
 *
 * This is called by the invite acceptance page before the user signs in with Google.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const inv = await validateInvitationToken(token);
  if (!inv) {
    return NextResponse.json(
      { error: "Invalid, expired, or already-used invitation link" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    invitation: {
      email: inv.email,
      invitedByName: inv.invitedByName,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    },
  });
}