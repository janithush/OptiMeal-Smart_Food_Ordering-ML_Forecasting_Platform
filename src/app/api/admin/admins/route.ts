import { requireApiRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { listAdmins, countPendingInvitations } from "@/lib/admin-management";

/**
 * GET /api/admin/admins
 *
 * List all admins (active and deactivated) for the admin management page.
 * Also returns pending invitation count so the UI can render the nav badge
 * without a second roundtrip.
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const [admins, pendingCount] = await Promise.all([
    listAdmins(auth.session.user.id),
    countPendingInvitations(),
  ]);

  return NextResponse.json({
    admins,
    pendingInvitations: pendingCount,
  });
}