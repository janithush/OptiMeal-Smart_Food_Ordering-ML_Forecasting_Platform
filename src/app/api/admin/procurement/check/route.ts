import { requireApiRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { runProcurementCheck } from "@/lib/procurement";

/**
 * POST /api/admin/procurement/check
 *
 * Triggers a fresh procurement check across all ingredients.
 * Compares current stock vs tomorrow's forecasted need.
 */
export async function POST() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const result = await runProcurementCheck();

  return NextResponse.json(result);
}
