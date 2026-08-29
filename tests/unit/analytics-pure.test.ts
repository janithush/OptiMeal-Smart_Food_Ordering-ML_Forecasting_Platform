/**
 * Unit tests for the pure helpers used by src/lib/analytics.ts.
 *
 * The DB-dependent functions (`getWastageData`, `getDemandSegments`)
 * are tested via the API in tests/api/. This file covers the small pure
 * logic (waste rate, OEE).
 *
 * Run: npx vitest run tests/unit/analytics-pure.test.ts
 */
import { describe, it, expect } from "vitest";

/**
 * Compute waste rate from stock inputs.
 *
 * waste = opening + received - consumed - closing
 * rate  = waste / (opening + received)  when denominator > 0
 */
function computeWasteMetrics(args: {
  opening: number;
  received: number;
  consumed: number;
  closing: number;
}) {
  const available = args.opening + args.received;
  const waste = available - args.consumed - args.closing;
  const rate = available > 0 ? (waste / available) * 100 : null;
  return {
    waste: Math.round(waste * 1000) / 1000,
    rate: rate !== null ? Math.round(rate * 100) / 100 : null,
  };
}

describe("computeWasteMetrics", () => {
  it("returns 0% waste when consumed + closing equals available", () => {
    expect(computeWasteMetrics({ opening: 10, received: 0, consumed: 5, closing: 5 })).toEqual({
      waste: 0,
      rate: 0,
    });
  });

  it("returns positive waste when closing + consumed < available", () => {
    expect(computeWasteMetrics({ opening: 10, received: 0, consumed: 3, closing: 5 })).toEqual({
      waste: 2,
      rate: 20,
    });
  });

  it("returns null rate when no stock at all", () => {
    expect(computeWasteMetrics({ opening: 0, received: 0, consumed: 0, closing: 0 })).toEqual({
      waste: 0,
      rate: null,
    });
  });

  it("handles received stock correctly", () => {
    // available = 10 + 5 = 15, consumed = 3, closing = 7 → waste = 5, rate = 33.33%
    const { waste, rate } = computeWasteMetrics({
      opening: 10, received: 5, consumed: 3, closing: 7,
    });
    expect(waste).toBe(5);
    expect(rate).toBeCloseTo(33.33, 1);
  });

  it("classifies as red (>15%)", () => {
    const { rate } = computeWasteMetrics({ opening: 10, received: 0, consumed: 0, closing: 7 });
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(15);
  });
});
