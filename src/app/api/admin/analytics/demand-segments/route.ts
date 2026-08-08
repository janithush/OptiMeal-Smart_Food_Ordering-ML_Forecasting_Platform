import { requireApiRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { getDemandSegments } from "@/lib/analytics";

/**
 * GET /api/admin/analytics/demand-segments — Demand by department & dietary preference.
 * NFR-8 compliant: aggregated data only.
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const data = await getDemandSegments();

  return NextResponse.json(data);
}
