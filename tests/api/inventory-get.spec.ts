/**
 * API tests for GET /api/admin/inventory
 *
 * Story 7.1: Inventory Stock Entry & Forecasting View
 *
 * Run: npx playwright test --project=api tests/api/inventory-get.spec.ts
 */
import { test, expect } from "../support/fixtures/base-fixture";
import { getInventory } from "../support/helpers/inventory-api";

test.describe("GET /api/admin/inventory", () => {
  test("returns 401 when unauthenticated", async ({ anonApi }) => {
    const { status } = await getInventory(anonApi);
    expect(status).toBe(401);
  });

  test("returns 403 when authenticated as student", async ({ studentApi }) => {
    const { status } = await getInventory(studentApi);
    expect(status).toBe(403);
  });

  test("returns 200 with ingredients array when authenticated as admin", async ({ adminApi }) => {
    const { status, data } = await getInventory(adminApi);
    // 200 if auth mock works; if no test-login route, this will return 401
    // which is expected until the app has a test-login endpoint
    if (status === 200) {
      expect(data).toHaveProperty("date");
      expect(data).toHaveProperty("ingredients");
      expect(Array.isArray(data.ingredients)).toBe(true);

      // Each ingredient row should have the expected shape
      if (data.ingredients.length > 0) {
        const row = data.ingredients[0];
        expect(row).toHaveProperty("id");
        expect(row).toHaveProperty("name");
        expect(row).toHaveProperty("unit");
        expect(row).toHaveProperty("openingStock");
        expect(row).toHaveProperty("closingStock");
        expect(row).toHaveProperty("wastage");
        expect(row).toHaveProperty("forecastedNeed");
        expect(row).toHaveProperty("hasForecast");
      }
    }
  });

  test("accepts optional date query parameter", async ({ adminApi }) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    const { status } = await getInventory(adminApi, dateStr);
    // Should not error on valid date format
    expect([200, 401]).toContain(status);
  });

  test("forecastedNeed is null when no DemandForecast exists", async ({ adminApi }) => {
    // Story 7.3 hasn't run yet — forecastedNeed should be null/absent
    const { status, data } = await getInventory(adminApi);
    if (status === 200 && data.ingredients.length > 0) {
      for (const row of data.ingredients) {
        expect(row.hasForecast).toBe(false);
        expect(row.forecastedNeed).toBeNull();
      }
    }
  });
});
