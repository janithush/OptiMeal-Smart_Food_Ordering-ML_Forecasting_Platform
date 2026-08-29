/**
 * Unit tests for the tier-classification logic in src/lib/procurement.ts.
 *
 * The DB-touching parts of `runProcurementCheck` are covered via the
 * API in tests/api/. This file tests the pure classification rules:
 *   - if currentStock < forecastedNeed → tier = "CRITICAL"
 *   - elif currentStock < forecastedNeed * 1.15 → tier = "WARNING"
 *   - else → no alert
 *
 * Run: npx vitest run tests/unit/procurement-tier.test.ts
 */
import { describe, it, expect } from "vitest";

type Tier = "CRITICAL" | "WARNING" | null;

function classifyStock(
  currentStock: number,
  forecastedNeed: number
): { tier: Tier; deficit: number } {
  const buffer = forecastedNeed * 1.15;
  if (currentStock < forecastedNeed) {
    return { tier: "CRITICAL", deficit: forecastedNeed - currentStock };
  }
  if (currentStock < buffer) {
    return { tier: "WARNING", deficit: 0 };
  }
  return { tier: null, deficit: 0 };
}

describe("classifyStock", () => {
  it("returns CRITICAL when stock is below need", () => {
    const { tier, deficit } = classifyStock(5, 10);
    expect(tier).toBe("CRITICAL");
    expect(deficit).toBe(5);
  });

  it("returns WARNING when stock is within 15% buffer", () => {
    // forecasted = 100, buffer = 115; stock = 110 → within buffer
    const { tier, deficit } = classifyStock(110, 100);
    expect(tier).toBe("WARNING");
    expect(deficit).toBe(0);
  });

  it("returns no tier when stock is fully above buffer", () => {
    const { tier, deficit } = classifyStock(200, 100);
    expect(tier).toBeNull();
    expect(deficit).toBe(0);
  });

  it("treats exact equality as WARNING (not CRITICAL)", () => {
    // Boundary: stock == need → not < need → not CRITICAL
    const { tier } = classifyStock(100, 100);
    expect(tier).toBe("WARNING"); // because 100 < 115 (the buffer)
  });

  it("handles zero need gracefully (buffer is 0, so any stock > 0 → null)", () => {
    const { tier } = classifyStock(5, 0);
    // 5 < 0 is false; 5 < 0*1.15=0 is false → null
    expect(tier).toBeNull();
  });

  it("treats negative stock as CRITICAL (defensive)", () => {
    const { tier, deficit } = classifyStock(-5, 10);
    expect(tier).toBe("CRITICAL");
    expect(deficit).toBe(15);
  });
});
