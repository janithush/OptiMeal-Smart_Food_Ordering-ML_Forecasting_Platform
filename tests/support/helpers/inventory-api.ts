import { APIRequestContext } from "@playwright/test";

/**
 * API helper for the Inventory endpoints (Story 7.1).
 *
 * Provides typed wrappers around /api/admin/inventory routes
 * for use in Playwright API tests.
 */

export interface InventoryRow {
  id: string;
  name: string;
  unit: string;
  openingStock: number | null;
  closingStock: number | null;
  wastage: number | null;
  forecastedNeed: number | null;
  hasForecast: boolean;
}

export interface InventoryResponse {
  date: string;
  ingredients: InventoryRow[];
}

export interface InventoryHistoryEntry {
  date: string;
  ingredients: Array<{
    id: string;
    name: string;
    unit: string;
    openingStock: number | null;
    closingStock: number | null;
    wastage: number | null;
  }>;
}

/**
 * GET /api/admin/inventory — Fetch today's inventory with forecasted need.
 */
export async function getInventory(
  api: APIRequestContext,
  date?: string
): Promise<{ status: number; data: InventoryResponse }> {
  const url = date ? `/api/admin/inventory?date=${date}` : "/api/admin/inventory";
  const res = await api.get(url);
  return { status: res.status(), data: await res.json() };
}

/**
 * POST /api/admin/inventory — Create or update a stock entry.
 */
export async function saveStockEntry(
  api: APIRequestContext,
  body: {
    ingredientId: string;
    date: string;
    openingStock: number;
    closingStock?: number | null;
  }
): Promise<{ status: number; data: unknown }> {
  const res = await api.post("/api/admin/inventory", { data: body });
  return { status: res.status(), data: await res.json() };
}

/**
 * GET /api/admin/inventory/history — Fetch 7-day inventory history.
 */
export async function getInventoryHistory(
  api: APIRequestContext,
  from?: string,
  to?: string
): Promise<{ status: number; data: { history: InventoryHistoryEntry[] } }> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const url = `/api/admin/inventory/history?${params.toString()}`;
  const res = await api.get(url);
  return { status: res.status(), data: await res.json() };
}
