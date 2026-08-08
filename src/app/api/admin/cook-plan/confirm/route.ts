import { requireApiRole } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { confirmCookPlan } from "@/lib/cook-plan";

/**
 * POST /api/admin/cook-plan/confirm — Confirm all SUGGESTED CookPlanItems for a given date.
 * Request body: { date?: "YYYY-MM-DD" } — defaults to today if omitted.
 * Triggers procurement re-check after confirmation.
 */
export async function POST(req: NextRequest) {
  const roleAuth = await requireApiRole("ADMIN");
  if (roleAuth.error) return roleAuth.error;

  const body = await req.json().catch(() => ({}));
  const date = body.date ?? undefined;

  const result = await confirmCookPlan("admin", "Admin", date);

  return NextResponse.json({
    success: true,
    confirmed: result.confirmed,
    procurementAlertsTriggered: result.procurementAlertsTriggered,
  });
}
