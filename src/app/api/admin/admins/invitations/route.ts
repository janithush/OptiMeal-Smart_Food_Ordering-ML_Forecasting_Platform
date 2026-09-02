import { requireApiRole } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { createInvitation, listInvitations } from "@/lib/admin-management";

/**
 * GET /api/admin/admins/invitations
 * POST /api/admin/admins/invitations
 *
 * GET: List all invitations (filter by ?status=pending|accepted|cancelled|expired|all)
 * POST: Create a new invitation. Returns the one-time token URL.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const status = (req.nextUrl.searchParams.get("status") ?? "all") as
    | "pending"
    | "accepted"
    | "cancelled"
    | "expired"
    | "all";

  const invitations = await listInvitations(status);
  return NextResponse.json({ invitations });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const baseUrl = String(
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  try {
    const invitation = await createInvitation(
      auth.session.user.id,
      auth.session.user.name ?? "Admin",
      email,
      {
        ipAddress:
          req.headers.get("x-forwarded-for") ??
          req.headers.get("x-real-ip") ??
          undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
      }
    );

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          token: invitation.token,
          invitedByName: invitation.invitedByName,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
          inviteUrl: `${baseUrl}/admin/invite/${invitation.token}`,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invitation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}