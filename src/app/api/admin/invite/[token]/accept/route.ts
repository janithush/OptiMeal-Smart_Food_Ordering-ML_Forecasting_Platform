import { verifyApiAuth } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { acceptInvitation } from "@/lib/admin-management";

/**
 * POST /api/admin/invite/[token]/accept
 *
 * Called by the client after the user has signed in with Google on the
 * invite acceptance page. Promotes the signed-in user to ADMIN and
 * marks the invitation as accepted.
 *
 * Requires the user to be authenticated (any role).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await verifyApiAuth();
  if (auth.error) return auth.error;

  const { token } = await params;
  const userId = auth.session.user.id;
  const userEmail = auth.session.user.email ?? "";

  if (!userEmail) {
    return NextResponse.json(
      { error: "Signed-in user has no email" },
      { status: 400 }
    );
  }

  try {
    const { user } = await acceptInvitation(token, userId, userEmail, {
      ipAddress:
        req.headers.get("x-forwarded-for") ??
        req.headers.get("x-real-ip") ??
        undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({
      success: true,
      user: { id: user.id, role: user.role },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to accept invitation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}