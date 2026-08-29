/**
 * Unit tests for lib/inventory.ts — validation helpers
 *
 * Story 7.1: Inventory Stock Entry & Forecasting View
 *
 * IMPORTANT: All date math in these tests is performed in the
 * **Asia/Colombo (UTC+5:30) timezone** because the production code
 * (`validateStockDate`, `getTodayDate`, etc.) is strictly localized
 * to Sri Lanka. Using raw `Date.UTC(...)` or `new Date().toISOString()`
 * here would produce a date string that is *off by one* for ~5 hours
 * of every day. See `tests/support/helpers/colombo-date.ts`.
 *
 * Run: npx vitest run tests/unit/inventory-validation.test.ts
 */
import { describe, it, expect } from "vitest";
import { validateStockDate, validateStockAmounts } from "@/lib/inventory";
import {
  getColomboOffsetString,
  getColomboTodayString,
} from "../support/helpers/colombo-date";

describe("validateStockDate", () => {
  it("rejects dates older than 1 day", () => {
    // 3 days ago in Colombo time
    const dateStr = getColomboOffsetString(-3);
    const error = validateStockDate(dateStr);
    expect(error).toContain("backdated");
  });

  it("rejects future dates", () => {
    // Tomorrow in Colombo time
    const dateStr = getColomboOffsetString(+1);
    const error = validateStockDate(dateStr);
    expect(error).toContain("future");
  });

  it("accepts today's date", () => {
    const dateStr = getColomboTodayString();
    const error = validateStockDate(dateStr);
    expect(error).toBeNull();
  });

  it("accepts yesterday's date (within 1 day)", () => {
    const dateStr = getColomboOffsetString(-1);
    const error = validateStockDate(dateStr);
    expect(error).toBeNull();
  });
});

describe("validateStockAmounts", () => {
  it("accepts valid opening and closing stock", () => {
    const error = validateStockAmounts(25.0, null, null, 22.5);
    expect(error).toBeNull();
  });

  it("accepts null closing stock", () => {
    const error = validateStockAmounts(25.0, null, null, null);
    expect(error).toBeNull();
  });

  it("rejects negative opening stock", () => {
    const error = validateStockAmounts(-5, null, null, 10);
    expect(error).toContain("negative");
  });

  it("rejects negative closing stock", () => {
    const error = validateStockAmounts(25, null, null, -5);
    expect(error).toContain("negative");
  });

  it("accepts zero opening stock", () => {
    const error = validateStockAmounts(0, null, null, 0);
    expect(error).toBeNull();
  });

  it("rejects negative received stock", () => {
    const error = validateStockAmounts(10, -1, null, 5);
    expect(error).toContain("negative");
  });

  it("rejects negative consumed stock", () => {
    const error = validateStockAmounts(10, null, -1, 5);
    expect(error).toContain("negative");
  });

  it("accepts all valid fields", () => {
    const error = validateStockAmounts(25.0, 5.0, 7.5, 22.0);
    expect(error).toBeNull();
  });
});
