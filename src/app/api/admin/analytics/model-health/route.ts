import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/analytics/model-health — Latest training log per menu item.
 */
export async function GET() {
  var auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  // Get all active menu items
  var menuItems = await prisma.menuItem.findMany({
    where: { isActive: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  // Get the most recent TrainingLog per item name
  var logs = await prisma.trainingLog.findMany({
    orderBy: { trainedAt: "desc" },
  });

  // Group by itemName, keep only the latest
  var latestMap = new Map<string, typeof logs[0]>();
  for (var log of logs) {
    if (!latestMap.has(log.itemName)) {
      latestMap.set(log.itemName, log);
    }
  }

  var models = menuItems.map(function (mi) {
    var log = latestMap.get(mi.name);
    if (log) {
      return {
        itemName: log.itemName,
        lastTrained: log.trainedAt.toISOString(),
        rowsUsed: log.rowsUsed,
        mae: log.mae,
        r2: log.r2,
        rolledBack: log.rolledBack,
        modelVersion: log.modelVersion,
      };
    }
    return {
      itemName: mi.name,
      lastTrained: null,
      rowsUsed: 0,
      mae: null,
      r2: null,
      rolledBack: false,
      modelVersion: null,
    };
  });

  return NextResponse.json({ models });
}
