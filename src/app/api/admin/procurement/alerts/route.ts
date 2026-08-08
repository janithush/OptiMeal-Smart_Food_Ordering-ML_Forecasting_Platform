import { requireApiRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { getProcurementAlerts } from "@/lib/procurement";

/**
 * GET /api/admin/procurement/alerts
 *
 * Returns all unresolved procurement alerts for today.
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const alerts = await getProcurementAlerts();

  return NextResponse.json({ alerts });
}
