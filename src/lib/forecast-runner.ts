/**
 * forecast-runner.ts — Nightly forecast orchestration.
 *
 * Full flow: gather data → call ML service → save to DB → check High Traffic.
 * Implements fault-tolerant fallback (AD-8) when ML service is unavailable.
 */

import { prisma } from "@/lib/prisma";
import { callMLForecast, type MLForecastItem } from "@/lib/ml-client";
import { getIO } from "@/lib/socket-server";
import { getTomorrowDate, getTodayDate } from "@/lib/inventory";

// ── Types ────────────────────────────────────────────────────────

export interface ForecastResult {
  forecastsGenerated: number;
  highTraffic: boolean;
  fallbackUsed: boolean;
}

// ── Semester Period Resolution ───────────────────────────────────

const SEMESTER_PERIODS = [
  "REGULAR_LECTURES",
  "PRE_EXAM_WEEK",
  "STUDY_LEAVE",
  "EXAM_PERIOD",
] as const;
type SemesterPeriod = (typeof SEMESTER_PERIODS)[number];

const SYSTEM_LAUNCH_DATE = new Date("2026-01-01");

export async function getSemesterPeriod(forDate: Date): Promise<SemesterPeriod> {
  const entry = await prisma.academicCalendar.findFirst({
    where: {
      startDate: { lte: forDate },
      endDate: { gte: forDate },
    },
    orderBy: { startDate: "desc" },
  });

  if (entry && SEMESTER_PERIODS.includes(entry.semesterPeriod as SemesterPeriod)) {
    return entry.semesterPeriod as SemesterPeriod;
  }
  return "REGULAR_LECTURES";
}

// ── Data Gathering ───────────────────────────────────────────────

async function getHistoricalSales(
  menuItemId: string,
  days: number = 30
): Promise<number[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRawUnsafe<{ d: string; qty: bigint }[]>(
    `SELECT o."createdAt"::date::text AS d, COALESCE(SUM(oi."quantity"), 0)::bigint AS qty
     FROM "OrderItem" oi
     JOIN "Order" o ON o.id = oi."orderId"
     WHERE oi."menuItemId" = $1 AND o."createdAt" >= $2
     GROUP BY o."createdAt"::date
     ORDER BY d ASC`,
    menuItemId,
    since
  );

  return rows.map((r) => Number(r.qty));
}

async function getRollingAvg(menuItemId: string, days: number): Promise<number> {
  const sales = await getHistoricalSales(menuItemId, days);
  if (sales.length === 0) return 0;
  return sales.reduce((s, v) => s + v, 0) / sales.length;
}

async function getPreOrderCount(menuItemId: string, tomorrow: Date): Promise<number> {
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const result = await prisma.orderItem.aggregate({
    where: {
      menuItemId,
      order: {
        type: "PRE_ORDER",
        createdAt: { gte: tomorrow, lte: tomorrowEnd },
      },
    },
    _sum: { quantity: true },
  });

  return result._sum.quantity ?? 0;
}

async function buildForecastPayload(
  items: { id: string; name: string }[],
  tomorrow: Date,
  semesterPeriod: string
): Promise<{ date: string; semester_period: string; items: MLForecastItem[] }> {
  const tomorrowDate = tomorrow.toISOString().split("T")[0];
  const dayOfWeek = tomorrow.getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const daysSinceLaunch = Math.floor(
    (tomorrow.getTime() - SYSTEM_LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24)
  );

  const itemPayloads: MLForecastItem[] = await Promise.all(
    items.map(async (item) => {
      const [historicalSales, rolling7d, rolling14d, preOrderCount] = await Promise.all([
        getHistoricalSales(item.id, 30),
        getRollingAvg(item.id, 7),
        getRollingAvg(item.id, 14),
        getPreOrderCount(item.id, tomorrow),
      ]);

      return {
        menuItemId: item.id,
        name: item.name,
        historical_sales: historicalSales,
        pre_order_count: preOrderCount,
        day_of_week: dayOfWeek,
        is_weekend: isWeekend,
        days_since_launch: daysSinceLaunch,
        rolling_7d_avg: rolling7d,
        rolling_14d_avg: rolling14d,
      };
    })
  );

  return {
    date: tomorrowDate,
    semester_period: semesterPeriod,
    items: itemPayloads,
  };
}

// ── Fallback Logic ───────────────────────────────────────────────

async function emitAdminAlert(event: string, message: string): Promise<void> {
  try {
    const io = getIO();
    io.of("/admin").emit("procurementAlert", {
      type: event,
      message,
      timestamp: new Date().toISOString(),
    });
    console.log(`[forecast] Admin alert emitted: ${event}`);
  } catch (err) {
    console.warn("[forecast] Could not emit admin alert:", err);
  }
}

async function applyFallbackForecast(
  tomorrow: Date,
  items: { id: string; name: string }[]
): Promise<ForecastResult> {
  const yesterday = new Date(tomorrow);
  yesterday.setDate(yesterday.getDate() - 1);

  let fallbackCount = 0;

  for (const item of items) {
    const yesterdaySales = await prisma.orderItem.aggregate({
      where: {
        menuItemId: item.id,
        order: {
          createdAt: {
            gte: new Date(yesterday.toISOString().split("T")[0] + "T00:00:00.000Z"),
            lte: new Date(yesterday.toISOString().split("T")[0] + "T23:59:59.999Z"),
          },
        },
      },
      _sum: { quantity: true },
    });

    const qty = yesterdaySales._sum.quantity ?? 0;

    await prisma.demandForecast.upsert({
      where: { date_menuItemId: { date: tomorrow, menuItemId: item.id } },
      create: {
        date: tomorrow,
        menuItemId: item.id,
        predictedQty: qty,
        lowEstimate: Math.max(0, qty - 5),
        highEstimate: qty + 5,
        confidenceScore: 0,
        modelVersion: "fallback-actuals",
      },
      update: {
        predictedQty: qty,
        lowEstimate: Math.max(0, qty - 5),
        highEstimate: qty + 5,
        confidenceScore: 0,
        modelVersion: "fallback-actuals",
      },
    });
    fallbackCount++;
  }

  await emitAdminAlert(
    "ml_service_unavailable",
    `ML forecast failed — using fallback actuals for ${fallbackCount} items`
  );

  return { forecastsGenerated: fallbackCount, highTraffic: false, fallbackUsed: true };
}

// ── High Traffic Check ───────────────────────────────────────────

async function get7DayRollingAverage(): Promise<number> {
  const today = getTodayDate();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const result = await prisma.orderItem.aggregate({
    where: {
      order: {
        createdAt: {
          gte: sevenDaysAgo,
          lte: today,
        },
      },
    },
    _sum: { quantity: true },
  });

  const total = result._sum.quantity ?? 0;
  return total / 7;
}

function emitStaffPlanningUpdate(data: {
  date: string;
  highTraffic: boolean;
  predictedTotal: number;
  rollingAvg: number;
}): void {
  try {
    const io = getIO();
    io.of("/admin").emit("staffPlanningUpdate", {
      ...data,
      timestamp: new Date().toISOString(),
    });
    console.log(`[forecast] Staff planning update emitted: highTraffic=${data.highTraffic}`);
  } catch (err) {
    console.warn("[forecast] Could not emit staff planning update:", err);
  }
}

// ── Main Entry Point ─────────────────────────────────────────────

export async function runNightlyForecast(): Promise<ForecastResult> {
  const tomorrow = getTomorrowDate();
  const semesterPeriod = await getSemesterPeriod(tomorrow);

  console.log(
    `[forecast] Running nightly forecast for ${tomorrow.toISOString().split("T")[0]} (semester: ${semesterPeriod})`
  );

  // 1. Gather active menu items
  const items = await prisma.menuItem.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  if (items.length === 0) {
    console.log("[forecast] No active menu items — skipping");
    return { forecastsGenerated: 0, highTraffic: false, fallbackUsed: false };
  }

  // 2. Build feature payload
  const payload = await buildForecastPayload(items, tomorrow, semesterPeriod);

  // 3. Call ML service (or fallback)
  let forecasts;
  const fallbackUsed = false;
  try {
    forecasts = await callMLForecast(payload);
    console.log(`[forecast] ML service returned ${forecasts.length} predictions`);
  } catch (err) {
    console.error("[forecast] ML service failed, using fallback:", err);
    return await applyFallbackForecast(tomorrow, items);
  }

  // 4. Save to DemandForecast (upsert)
  for (const f of forecasts) {
    await prisma.demandForecast.upsert({
      where: {
        date_menuItemId: {
          date: tomorrow,
          menuItemId: f.menuItemId,
        },
      },
      create: {
        date: tomorrow,
        menuItemId: f.menuItemId,
        predictedQty: f.predictedQty,
        lowEstimate: f.lowEstimate,
        highEstimate: f.highEstimate,
        confidenceScore: f.confidenceScore,
        modelVersion: f.modelVersion,
      },
      update: {
        predictedQty: f.predictedQty,
        lowEstimate: f.lowEstimate,
        highEstimate: f.highEstimate,
        confidenceScore: f.confidenceScore,
        modelVersion: f.modelVersion,
      },
    });
  }

  // 4.5 Generate SUGGESTED Cook Plan from the forecast data
  try {
    const { generateCookPlan } = await import("@/lib/cook-plan");
    const cookPlanResult = await generateCookPlan(tomorrow);
    console.log(`[forecast] Cook Plan generated — ${cookPlanResult.itemsGenerated} items`);
  } catch (err) {
    console.error("[forecast] Cook Plan generation failed:", err);
    // Non-fatal — forecast itself succeeded
  }

  // 5. Check High Traffic
  const predictedTotal = forecasts.reduce((s, f) => s + f.predictedQty, 0);
  const rollingAvg = await get7DayRollingAverage();
  const highTraffic = rollingAvg > 0 && predictedTotal > rollingAvg * 1.20;

  if (highTraffic) {
    emitStaffPlanningUpdate({
      date: tomorrow.toISOString().split("T")[0],
      highTraffic,
      predictedTotal,
      rollingAvg,
    });
  }

  console.log(
    `[forecast] Complete — ${forecasts.length} items, ` +
      `predictedTotal=${predictedTotal}, rolling7dAvg=${rollingAvg.toFixed(1)}, ` +
      `highTraffic=${highTraffic}, fallback=${fallbackUsed}`
  );

  return { forecastsGenerated: forecasts.length, highTraffic, fallbackUsed };
}
