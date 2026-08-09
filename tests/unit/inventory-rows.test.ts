/**
 * Unit tests for lib/inventory.ts — forecasted need & inventory rows
 *
 * Story 7.1: Inventory Stock Entry & Forecasting View
 *
 * Run: npx vitest run tests/unit/inventory-rows.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma at module level
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingredient: {
      findMany: vi.fn(),
    },
    menuItemIngredient: {
      findMany: vi.fn(),
    },
    inventoryRecord: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  buildInventoryRows,
  calculateForecastedNeed,
  getTodayDate,
  getTomorrowDate,
} from "@/lib/inventory";

const mockPrisma = prisma as unknown as {
  ingredient: { findMany: ReturnType<typeof vi.fn> };
  menuItemIngredient: { findMany: ReturnType<typeof vi.fn> };
  inventoryRecord: { findMany: ReturnType<typeof vi.fn> };
};

describe("getTodayDate", () => {
  it("returns start of today in UTC", () => {
    const today = getTodayDate();
    expect(today.getUTCHours()).toBe(0);
    expect(today.getUTCMinutes()).toBe(0);
    expect(today.getUTCSeconds()).toBe(0);
  });
});

describe("getTomorrowDate", () => {
  it("returns start of tomorrow in UTC", () => {
    const today = getTodayDate();
    const tomorrow = getTomorrowDate();
    const diffMs = tomorrow.getTime() - today.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe("calculateForecastedNeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no DemandForecast exists", async () => {
    mockPrisma.menuItemIngredient.findMany.mockResolvedValue([]);

    const tomorrow = getTomorrowDate();
    const result = await calculateForecastedNeed("ing-1", tomorrow);

    expect(result.total).toBe(0);
    expect(result.hasForecast).toBe(false);
  });

  it("correctly computes forecasted need from MenuItemIngredient × DemandForecast", async () => {
    mockPrisma.menuItemIngredient.findMany.mockResolvedValue([
      {
        menuItemId: "menu-1",
        ingredientId: "ing-1",
        quantityPerPortion: 0.25, // 0.250 kg per portion
        menuItem: {
          demandForecasts: [
            {
              id: "df-1",
              date: new Date(),
              menuItemId: "menu-1",
              predictedQty: 100,
              lowEstimate: 80,
              highEstimate: 120,
              confidenceScore: 85,
              modelVersion: "v1",
              generatedAt: new Date(),
            },
          ],
        },
      },
      {
        menuItemId: "menu-2",
        ingredientId: "ing-1",
        quantityPerPortion: 0.15,
        menuItem: {
          demandForecasts: [
            {
              id: "df-2",
              date: new Date(),
              menuItemId: "menu-2",
              predictedQty: 50,
              lowEstimate: 40,
              highEstimate: 60,
              confidenceScore: 90,
              modelVersion: "v1",
              generatedAt: new Date(),
            },
          ],
        },
      },
    ] as never);

    const tomorrow = getTomorrowDate();
    const result = await calculateForecastedNeed("ing-1", tomorrow);

    // 0.25 × 100 + 0.15 × 50 = 25 + 7.5 = 32.5
    expect(result.total).toBeCloseTo(32.5, 3);
    expect(result.hasForecast).toBe(true);
  });

  it("handles mixed: some menu items have forecasts, some don't", async () => {
    mockPrisma.menuItemIngredient.findMany.mockResolvedValue([
      {
        menuItemId: "menu-1",
        ingredientId: "ing-1",
        quantityPerPortion: 0.1,
        menuItem: {
          demandForecasts: [
            {
              id: "df-1",
              date: new Date(),
              menuItemId: "menu-1",
              predictedQty: 80,
              lowEstimate: 60,
              highEstimate: 100,
              confidenceScore: 70,
              modelVersion: "v1",
              generatedAt: new Date(),
            },
          ],
        },
      },
      {
        menuItemId: "menu-3",
        ingredientId: "ing-1",
        quantityPerPortion: 0.3,
        menuItem: {
          demandForecasts: [], // No forecast for this menu item
        },
      },
    ] as never);

    const tomorrow = getTomorrowDate();
    const result = await calculateForecastedNeed("ing-1", tomorrow);

    // 0.1 × 80 = 8 (menu-3 has no forecast, skipped)
    expect(result.total).toBeCloseTo(8, 3);
    expect(result.hasForecast).toBe(true); // at least one has forecast
  });
});

describe("buildInventoryRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ingredients with null stock when no records exist", async () => {
    mockPrisma.ingredient.findMany.mockResolvedValue([
      { id: "ing-2", name: "Chicken", unit: "kg", createdAt: new Date() },
      { id: "ing-1", name: "Rice", unit: "kg", createdAt: new Date() },
    ] as never);

    mockPrisma.inventoryRecord.findMany.mockResolvedValue([]);
    mockPrisma.menuItemIngredient.findMany.mockResolvedValue([]);

    const today = getTodayDate();
    const rows = await buildInventoryRows(today);

    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Chicken");
    expect(rows[0].openingStock).toBeNull();
    expect(rows[0].closingStock).toBeNull();
    expect(rows[0].wastage).toBeNull();
    expect(rows[0].hasForecast).toBe(false);
  });

  it("returns stock values when records exist", async () => {
    const today = getTodayDate();
    mockPrisma.ingredient.findMany.mockResolvedValue([
      { id: "ing-1", name: "Rice", unit: "kg", createdAt: new Date() },
    ] as never);

    mockPrisma.inventoryRecord.findMany.mockResolvedValue([
      {
        id: "rec-1",
        ingredientId: "ing-1",
        date: today,
        openingStock: 25.0,
        receivedStock: null,
        consumedStock: null,
        closingStock: 22.0,
        wastage: 3.0,
        createdAt: new Date(),
      },
    ] as never);

    mockPrisma.menuItemIngredient.findMany.mockResolvedValue([]);

    const rows = await buildInventoryRows(today);

    expect(rows[0].openingStock).toBe(25.0);
    expect(rows[0].closingStock).toBe(22.0);
    expect(rows[0].wastage).toBe(3.0);
  });
});
