import { requireApiRole } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { getCookPlan, generateCookPlan } from "@/lib/cook-plan";
import { getTodayDate } from "@/lib/date-utils";

/**
 * GET /api/admin/cook-plan — Returns the Cook Plan for a given date.
 * POST /api/admin/cook-plan — Manually trigger Cook Plan generation from DemandForecast.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");

  let date: Date;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    date = new Date(dateParam + "T00:00:00Z");
  } else {
    date = getTodayDate();
  }

  const plan = await getCookPlan(date);

  return NextResponse.json(plan);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const dateStr = body.date;

  let date: Date;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    date = new Date(dateStr + "T00:00:00Z");
  } else {
    date = getTodayDate();
  }

  const result = await generateCookPlan(date);

  return NextResponse.json({
    success: true,
    date: date.toISOString().split("T")[0],
    itemsGenerated: result.itemsGenerated,
  });
}
