import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getTomorrowDate } from "@/lib/inventory";

/**
 * GET /api/admin/forecasts/latest
 *
 * Returns the latest DemandForecast records for a given date.
 * Query params: date (optional, defaults to tomorrow)
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
    date = getTomorrowDate();
  }

  const forecasts = await prisma.demandForecast.findMany({
    where: { date },
    include: {
      menuItem: { select: { name: true } },
    },
    orderBy: { predictedQty: "desc" },
  });

  // Determine semester period for the forecast date
  const semesterEntry = await prisma.academicCalendar.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date },
    },
    orderBy: { startDate: "desc" },
  });
  const semesterPeriod = semesterEntry?.semesterPeriod ?? "REGULAR_LECTURES";

  // Compuate High Traffic flag
  const predictedTotal = forecasts.reduce(
    (s, f) => s + f.predictedQty, 0
  );

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentOrders = await prisma.orderItem.aggregate({
    where: {
      order: {
        createdAt: { gte: sevenDaysAgo, lte: today },
      },
    },
    _sum: { quantity: true },
  });
  const rollingAvg = (recentOrders._sum.quantity ?? 0) / 7;
  const highTraffic = rollingAvg > 0 && predictedTotal > rollingAvg * 1.20;

  return NextResponse.json({
    date: date.toISOString().split("T")[0],
    forecasts: forecasts.map((f) => ({
      menuItemId: f.menuItemId,
      menuItemName: f.menuItem.name,
      predictedQty: f.predictedQty,
      lowEstimate: f.lowEstimate,
      highEstimate: f.highEstimate,
      confidenceScore: Number(f.confidenceScore),
      modelVersion: f.modelVersion,
    })),
    highTrafficFlag: highTraffic,
    semesterPeriod,
    predictedTotal,
    rollingAvg: Math.round(rollingAvg),
  });
}
