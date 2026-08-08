/**
 * Unit tests for lib/inventory.ts — validation helpers
 *
 * Story 7.1: Inventory Stock Entry & Forecasting View
 *
 * Run: npx vitest run tests/unit/inventory-validation.test.ts
 */
import { describe, it, expect } from "vitest";
import { validateStockDate, validateStockAmounts } from "@/lib/inventory";

describe("validateStockDate", () => {
  it("rejects dates older than 1 day", () => {
    // 3 days ago in UTC
    const now = new Date();
    const dateStr = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3)
    )
      .toISOString()
      .split("T")[0];

    const error = validateStockDate(dateStr);
    expect(error).toContain("backdated");
  });

  it("rejects future dates", () => {
    // Tomorrow in UTC
    const now = new Date();
    const dateStr = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    )
      .toISOString()
      .split("T")[0];

    const error = validateStockDate(dateStr);
    expect(error).toContain("future");
  });

  it("accepts today's date", () => {
    // Today in UTC
    const now = new Date();
    const dateStr = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    )
      .toISOString()
      .split("T")[0];

    const error = validateStockDate(dateStr);
    expect(error).toBeNull();
  });

  it("accepts yesterday's date (within 1 day)", () => {
    // Use UTC to avoid timezone boundary issues
    const now = new Date();
    const yesterdayIso = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
    )
      .toISOString()
      .split("T")[0];

    const error = validateStockDate(yesterdayIso);
    expect(error).toBeNull();
  });
});

describe("validateStockAmounts", () => {
  it("accepts valid opening and closing stock", () => {
    const error = validateStockAmounts(25.0, 22.5);
    expect(error).toBeNull();
  });

  it("accepts null closing stock", () => {
    const error = validateStockAmounts(25.0, null);
    expect(error).toBeNull();
  });

  it("rejects negative opening stock", () => {
    const error = validateStockAmounts(-5, 10);
    expect(error).toContain("negative");
  });

  it("rejects negative closing stock", () => {
    const error = validateStockAmounts(25, -5);
    expect(error).toContain("negative");
  });

  it("accepts zero opening stock", () => {
    const error = validateStockAmounts(0, 0);
    expect(error).toBeNull();
  });
});
