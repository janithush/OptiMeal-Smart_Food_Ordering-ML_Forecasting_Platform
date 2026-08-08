/**
 * analytics.ts — NFR-8 compliant read-only aggregation queries.
 *
 * Centralized data layer for Admin Analytics:
 *   - Wastage heatmap (7-day rolling per ingredient)
 *   - Demand segments (by department & dietary preference, 30-day)
 *
 * All queries use groupBy / $queryRawUnsafe for aggregation only.
 * No individual Student data is ever returned (NFR-8).
 */

import { prisma } from "@/lib/prisma";
import { getTodayDate } from "@/lib/date-utils";

// ── Types ────────────────────────────────────────────────────────

export interface WastageDay {
  date: string;
  openingStock: number | null;
  receivedStock: number | null;
  consumedStock: number | null;
  closingStock: number | null;
  wastage: number | null;
  wasteRate: number | null;
}

export interface WastageIngredient {
  id: string;
  name: string;
  unit: string;
  days: WastageDay[];
}

export interface WastageResponse {
  dateRange: { from: string; to: string };
  ingredients: WastageIngredient[];
}

export interface DepartmentSegment {
  department: string;
  orderCount: number;
  quantitySold: number;
}

export interface DietarySegment {
  preference: string;
  orderCount: number;
  quantitySold: number;
}

export interface DemandSegmentsResponse {
  period: { from: string; to: string };
  byDepartment: DepartmentSegment[];
  byDietaryPreference: DietarySegment[];
}

// ── Wastage Data ──────────────────────────────────────────────────

export async function getWastageData(): Promise<WastageResponse> {
  const today = getTodayDate();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

  const ingredients = await prisma.ingredient.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const records = await prisma.inventoryRecord.findMany({
    where: {
      date: { gte: sevenDaysAgo, lte: today },
      ingredientId: { in: ingredients.map(function (i) { return i.id; }) },
    },
    orderBy: { date: "asc" },
  });

  // Build map: ingredientId → dateKey → record
  const recordMap = new Map();
  for (const r of records) {
    const dateKey = r.date.toISOString().split("T")[0];
    if (!recordMap.has(r.ingredientId)) recordMap.set(r.ingredientId, new Map());
    recordMap.get(r.ingredientId).set(dateKey, r);
  }

  // Build 7-day date list
  const days: string[] = [];
  const d = new Date(sevenDaysAgo);
  while (d <= today) {
    days.push(d.toISOString().split("T")[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return {
    dateRange: { from: days[0], to: days[days.length - 1] },
    ingredients: ingredients.map(function (ing) {
      const ingMap = recordMap.get(ing.id);
      return {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        days: days.map(function (dateKey) {
          const r = ingMap?.get(dateKey);
          if (!r) {
            return { date: dateKey, openingStock: null, receivedStock: null, consumedStock: null, closingStock: null, wastage: null, wasteRate: null };
          }
          const opening = Number(r.openingStock);
          const received = Number(r.receivedStock ?? 0);
          const consumed = Number(r.consumedStock ?? 0);
          const closing = Number(r.closingStock ?? 0);
          const waste = opening + received - consumed - closing;
          const available = opening + received;
          const wasteRate = available > 0 ? (waste / available) * 100 : null;
          return {
            date: dateKey,
            openingStock: opening,
            receivedStock: received,
            consumedStock: consumed,
            closingStock: closing,
            wastage: Math.round(waste * 1000) / 1000,
            wasteRate: wasteRate !== null ? Math.round(wasteRate * 100) / 100 : null,
          };
        }),
      };
    }),
  };
}

// ── Demand Segments ───────────────────────────────────────────────

export async function getDemandSegments(): Promise<DemandSegmentsResponse> {
  const today = getTodayDate();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  // By Department (NFR-8: aggregated only, no individual student data)
  const deptRows = await prisma.$queryRawUnsafe<
    { department: string; orders: bigint; qty: bigint }[]
  >(
    `SELECT u."department", COUNT(DISTINCT o.id)::bigint AS orders,
            COALESCE(SUM(oi."quantity"), 0)::bigint AS qty
     FROM "Order" o
     JOIN "User" u ON u.id = o."studentId"
     JOIN "OrderItem" oi ON oi."orderId" = o.id
     WHERE o."createdAt" >= $1 AND u."department" IS NOT NULL
     GROUP BY u."department"
     ORDER BY orders DESC`,
    thirtyDaysAgo
  );

  // By Dietary Preference
  const dietRows = await prisma.$queryRawUnsafe<
    { preference: string; orders: bigint; qty: bigint }[]
  >(
    `SELECT u."dietaryPreference" AS preference,
            COUNT(DISTINCT o.id)::bigint AS orders,
            COALESCE(SUM(oi."quantity"), 0)::bigint AS qty
     FROM "Order" o
     JOIN "User" u ON u.id = o."studentId"
     JOIN "OrderItem" oi ON oi."orderId" = o.id
     WHERE o."createdAt" >= $1 AND u."dietaryPreference" IS NOT NULL
     GROUP BY u."dietaryPreference"
     ORDER BY orders DESC`,
    thirtyDaysAgo
  );

  return {
    period: {
      from: thirtyDaysAgo.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    },
    byDepartment: deptRows.map(function (r) {
      return { department: r.department, orderCount: Number(r.orders), quantitySold: Number(r.qty) };
    }),
    byDietaryPreference: dietRows.map(function (r) {
      return { preference: r.preference, orderCount: Number(r.orders), quantitySold: Number(r.qty) };
    }),
  };
}
