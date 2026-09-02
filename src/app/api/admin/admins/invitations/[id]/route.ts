import { requireApiRole } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { cancelInvitation } from "@/lib/admin-management";

/**
 * DELETE /api/admin/admins/invitations/[id]
 *
 * Cancel a pending invitation. Only works on invitations that have not been
 * accepted or already cancelled.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    await cancelInvitation(id, auth.session.user.id, {
      ipAddress:
        req.headers.get("x-forwarded-for") ??
        req.headers.get("x-real-ip") ??
        undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel invitation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}