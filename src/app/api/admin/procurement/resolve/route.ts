import { requireApiRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { resolveAllAlerts } from "@/lib/procurement";

/**
 * POST /api/admin/procurement/resolve
 *
 * Marks all unresolved alerts for today as resolved.
 */
export async function POST() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const resolved = await resolveAllAlerts();

  return NextResponse.json({ resolved });
}
