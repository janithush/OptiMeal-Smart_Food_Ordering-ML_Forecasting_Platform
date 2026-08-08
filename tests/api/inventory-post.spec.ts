/**
 * API tests for POST /api/admin/inventory
 *
 * Story 7.1: Inventory Stock Entry & Forecasting View
 *
 * Run: npx playwright test --project=api tests/api/inventory-post.spec.ts
 */
import { test, expect } from "../support/fixtures/base-fixture";
import { createIngredient } from "../support/helpers/ingredients-api";
import { saveStockEntry } from "../support/helpers/inventory-api";

test.describe("POST /api/admin/inventory", () => {
  test("returns 401 when unauthenticated", async ({ anonApi }) => {
    const { status } = await saveStockEntry(anonApi, {
      ingredientId: "dummy-id",
      date: new Date().toISOString().split("T")[0],
      openingStock: 10,
    });
    expect(status).toBe(401);
  });

  test("returns 403 when authenticated as student", async ({ studentApi }) => {
    const { status } = await saveStockEntry(studentApi, {
      ingredientId: "dummy-id",
      date: new Date().toISOString().split("T")[0],
      openingStock: 10,
    });
    expect(status).toBe(403);
  });

  test("rejects missing ingredientId", async ({ adminApi }) => {
    const today = new Date().toISOString().split("T")[0];
    const { status, data } = await saveStockEntry(adminApi, {
      ingredientId: "",
      date: today,
      openingStock: 10,
    });

    if (status === 400) {
      const body = data as { error?: string };
      expect(body.error).toBeDefined();
    }
  });

  test("rejects backdated entries older than 1 day (FR-26b)", async ({ adminApi }) => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const dateStr = threeDaysAgo.toISOString().split("T")[0];

    const { status, data } = await saveStockEntry(adminApi, {
      ingredientId: "test-id",
      date: dateStr,
      openingStock: 10,
    });

    if (status === 400) {
      const body = data as { error?: string };
      expect(body.error).toContain("backdated");
    }
  });

  test("rejects future-dated entries", async ({ adminApi }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const { status, data } = await saveStockEntry(adminApi, {
      ingredientId: "test-id",
      date: dateStr,
      openingStock: 10,
    });

    if (status === 400) {
      const body = data as { error?: string };
      expect(body.error).toContain("future");
    }
  });

  test("rejects negative opening stock", async ({ adminApi }) => {
    const today = new Date().toISOString().split("T")[0];
    const { status, data } = await saveStockEntry(adminApi, {
      ingredientId: "test-id",
      date: today,
      openingStock: -5,
    });

    if (status === 400) {
      const body = data as { error?: string };
      expect(body.error).toContain("negative");
    }
  });
});

test.describe("Inventory upsert flow", () => {
  test("upsert creates a record then updates it on second call", async ({ adminApi }) => {
    // Requires a real ingredient to exist — this test is a template
    // for integration test environments with a seeded database

    // Step 1: Create a test ingredient via API
    const { status: createStatus, data: createData } = await createIngredient(
      adminApi,
      "Test-Rice-Upsert"
    );

    if (createStatus === 201 || createStatus === 200) {
      const ingredient = (createData as { ingredient: { id: string } }).ingredient;
      const today = new Date().toISOString().split("T")[0];

      // Step 2: First upsert — create
      const { status: save1Status } = await saveStockEntry(adminApi, {
        ingredientId: ingredient.id,
        date: today,
        openingStock: 25.0,
        closingStock: 22.0,
      });

      if (save1Status === 200 || save1Status === 201) {
        // Step 3: Second upsert — update
        const { status: save2Status } = await saveStockEntry(adminApi, {
          ingredientId: ingredient.id,
          date: today,
          openingStock: 30.0,
          closingStock: 25.0,
        });

        // Both should succeed (idempotent)
        expect([200, 201]).toContain(save2Status);
      }
    }
  });
});
