/**
 * retrain-runner.ts — Weekly ML model retraining orchestration.
 *
 * Full flow: gather order data → call ML /train → save TrainingLog → emit alerts.
 * Story 7.6: Automated Weekly Model Retraining Pipeline.
 */

import { prisma } from "@/lib/prisma";
import { callMLRetrain, type MLRetrainItem } from "@/lib/ml-client";
import { getIO } from "@/lib/socket-server";

// ── Types ────────────────────────────────────────────────────────

export interface RetrainResult {
  totalItems: number;
  trained: number;
  rolledBack: number;
  skipped: number;
}

// ── Data Gathering ───────────────────────────────────────────────

async function getHistoricalSales(
  menuItemId: string,
  days: number = 365
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

  return rows.map(function (r) { return Number(r.qty); });
}

// ── Alert Emitter ────────────────────────────────────────────────

function emitModelRetrainAlert(rollbacks: Array<{ itemName: string; mae: number; rollbackReason: string | null }>): void {
  try {
    const io = getIO();
    io.of("/admin").emit("modelRetrainAlert", {
      rollbacks: rollbacks,
      message: rollbacks.length + " model(s) rolled back due to MAE degradation",
      timestamp: new Date().toISOString(),
    });
    console.log("[retrain] Model retrain alert emitted — " + rollbacks.length + " rollbacks");
  } catch {
    // IO not initialized
  }
}

// ── Main Entry Point ─────────────────────────────────────────────

export async function runWeeklyRetraining(): Promise<RetrainResult> {
  console.log("[retrain] Starting weekly model retraining...");

  // 1. Gather active menu items
  const items = await prisma.menuItem.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  if (items.length === 0) {
    console.log("[retrain] No active menu items — skipping");
    return { totalItems: 0, trained: 0, rolledBack: 0, skipped: 0 };
  }

  // 2. Build payload with historical sales per item
  const payload: MLRetrainItem[] = [];
  let skipped = 0;

  for (const item of items) {
    const sales = await getHistoricalSales(item.id, 365);
    if (sales.length < 14) {
      skipped++;
      continue;
    }
    payload.push({
      menuItemId: item.id,
      name: item.name,
      historical_sales: sales,
    });
  }

  if (payload.length === 0) {
    console.log("[retrain] No items with sufficient data (" + skipped + " skipped)");
    return { totalItems: items.length, trained: 0, rolledBack: 0, skipped };
  }

  // 3. Call FastAPI /train
  let results;
  try {
    results = await callMLRetrain({
      semester_period: "REGULAR_LECTURES",
      items: payload,
    });
    console.log("[retrain] ML service returned " + results.length + " results");
  } catch (err) {
    console.error("[retrain] ML service failed:", err);
    return { totalItems: items.length, trained: 0, rolledBack: 0, skipped: items.length };
  }

  // 4. Save TrainingLog records
  let loggedCount = 0;
  for (const r of results) {
    await prisma.trainingLog.create({
      data: {
        itemName: r.itemName,
        rowsUsed: r.rowsUsed,
        mae: r.mae,
        r2: r.r2,
        rolledBack: r.rolledBack,
        modelVersion: r.modelVersion,
      },
    });
    loggedCount++;
  }
  console.log("[retrain] Saved " + loggedCount + " TrainingLog records");

  // 5. Emit alerts for rollbacks
  const rollbacks = results.filter(function (r) { return r.rolledBack; });
  if (rollbacks.length > 0) {
    emitModelRetrainAlert(
      rollbacks.map(function (r) {
        return { itemName: r.itemName, mae: r.mae, rollbackReason: r.rollbackReason };
      })
    );
  }

  const trained = results.length;
  console.log(
    "[retrain] Complete — " + trained + " trained, " +
    rollbacks.length + " rolled back, " + skipped + " skipped"
  );

  return { totalItems: items.length, trained, rolledBack: rollbacks.length, skipped };
}
