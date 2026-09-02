import { requireApiRole } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import {
  deactivateAdmin,
  demoteAdmin,
  reactivateAdmin,
} from "@/lib/admin-management";

/**
 * PATCH /api/admin/admins/[id]
 *   body: { action: "demote" | "reactivate" }
 *
 * Demote an admin back to STUDENT, or reactivate a deactivated admin.
 *
 * DELETE /api/admin/admins/[id]
 *   Soft-delete (deactivate) an admin. Refuses if it's the last active admin.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const action = String(body.action ?? "");

  const reqMeta = {
    ipAddress:
      req.headers.get("x-forwarded-for") ??
      req.headers.get("x-real-ip") ??
      undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  };

  try {
    if (action === "demote") {
      const user = await demoteAdmin(id, auth.session.user.id, reqMeta);
      return NextResponse.json({ success: true, user: { id: user.id, role: user.role } });
    }
    if (action === "reactivate") {
      const user = await reactivateAdmin(id, auth.session.user.id, reqMeta);
      return NextResponse.json({ success: true, user: { id: user.id, isActive: user.isActive } });
    }
    return NextResponse.json(
      { error: "Unknown action — must be 'demote' or 'reactivate'" },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update admin";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const user = await deactivateAdmin(id, auth.session.user.id, {
      ipAddress:
        req.headers.get("x-forwarded-for") ??
        req.headers.get("x-real-ip") ??
        undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ success: true, user: { id: user.id, isActive: user.isActive } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to deactivate admin";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}