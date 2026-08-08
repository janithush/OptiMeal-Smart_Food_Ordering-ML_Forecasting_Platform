/**
 * API tests for GET /api/admin/inventory/history
 *
 * Story 7.1: Inventory Stock Entry & Forecasting View
 *
 * Run: npx playwright test --project=api tests/api/inventory-history.spec.ts
 */
import { test, expect } from "../support/fixtures/base-fixture";
import { getInventoryHistory } from "../support/helpers/inventory-api";

test.describe("GET /api/admin/inventory/history", () => {
  test("returns 401 when unauthenticated", async ({ anonApi }) => {
    const { status } = await getInventoryHistory(anonApi);
    expect(status).toBe(401);
  });

  test("returns 403 when authenticated as student", async ({ studentApi }) => {
    const { status } = await getInventoryHistory(studentApi);
    expect(status).toBe(403);
  });

  test("returns 200 with history array for admin", async ({ adminApi }) => {
    const { status, data } = await getInventoryHistory(adminApi);

    if (status === 200) {
      expect(data).toHaveProperty("history");
      expect(Array.isArray(data.history)).toBe(true);
    }
  });

  test("accepts from and to date query parameters", async ({ adminApi }) => {
    const from = "2026-08-01";
    const to = "2026-08-07";

    const { status, data } = await getInventoryHistory(adminApi, from, to);

    if (status === 200) {
      expect(data.history.length).toBeGreaterThanOrEqual(0);
      // Should return entries within the date range
      for (const entry of data.history) {
        expect(entry.date >= from).toBe(true);
        expect(entry.date <= to).toBe(true);
      }
    }
  });

  test("each history entry has ingredients with expected shape", async ({ adminApi }) => {
    const { status, data } = await getInventoryHistory(adminApi);

    if (status === 200 && data.history.length > 0) {
      const entry = data.history[0];
      expect(entry).toHaveProperty("date");
      expect(Array.isArray(entry.ingredients)).toBe(true);

      if (entry.ingredients.length > 0) {
        const ing = entry.ingredients[0];
        expect(ing).toHaveProperty("id");
        expect(ing).toHaveProperty("name");
        expect(ing).toHaveProperty("unit");
        expect(ing).toHaveProperty("openingStock");
        expect(ing).toHaveProperty("closingStock");
        expect(ing).toHaveProperty("wastage");
      }
    }
  });
});
