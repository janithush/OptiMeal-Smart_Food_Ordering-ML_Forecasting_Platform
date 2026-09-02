import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { promoteUser } from "@/lib/admin-management";

/**
 * POST /api/admin/admins/promote
 *
 * Promote an existing user to ADMIN directly (the documented fallback flow).
 * Accepts either { email } or { regNo } to look up the user.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const email = body.email ? String(body.email).trim().toLowerCase() : null;
  const regNo = body.regNo ? String(body.regNo).trim() : null;

  if (!email && !regNo) {
    return NextResponse.json(
      { error: "Either 'email' or 'regNo' is required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findFirst({
    where: email ? { email } : { regNo },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const updated = await promoteUser(user.id, auth.session.user.id, {
      ipAddress:
        req.headers.get("x-forwarded-for") ??
        req.headers.get("x-real-ip") ??
        undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({
      success: true,
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to promote user";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}