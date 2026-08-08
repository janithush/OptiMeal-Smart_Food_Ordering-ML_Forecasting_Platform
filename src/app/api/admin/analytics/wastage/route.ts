import { requireApiRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { getWastageData } from "@/lib/analytics";

/**
 * GET /api/admin/analytics/wastage — 7-day rolling wastage per ingredient.
 * NFR-8 compliant: aggregated data only, no individual records exposed.
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const data = await getWastageData();

  return NextResponse.json(data);
}
