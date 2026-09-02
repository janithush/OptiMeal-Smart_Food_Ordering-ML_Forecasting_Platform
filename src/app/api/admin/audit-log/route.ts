import { requireApiRole } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { listAuditLogs } from "@/lib/admin-management";

/**
 * GET /api/admin/audit-log
 *
 * List recent admin-management audit log entries (most recent first).
 * Query: ?limit=N (default 50, max 200)
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const limitRaw = req.nextUrl.searchParams.get("limit");
  let limit = limitRaw ? parseInt(limitRaw, 10) : 50;
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;

  const logs = await listAuditLogs(limit);
  return NextResponse.json({ logs });
}