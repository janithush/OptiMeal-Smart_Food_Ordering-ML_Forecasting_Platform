/**
 * Unit tests for the pure helper used by src/lib/forecast-runner.ts.
 *
 * Tests the payload-shape construction (without exercising the DB).
 * The full forecast pipeline (DB + ML service call) is covered by
 * integration tests in tests/api/.
 *
 * Run: npx vitest run tests/unit/forecast-runner-payload.test.ts
 */
import { describe, it, expect } from "vitest";

function buildPayloadShape(args: {
  date: string;
  semesterPeriod: string;
  items: Array<{ id: string; name: string }>;
  historicalMap: Record<string, number[]>;
  rolling7d: Record<string, number>;
  rolling14d: Record<string, number>;
  preOrderMap: Record<string, number>;
  dayOfWeek: number;
  isWeekend: boolean;
  daysSinceLaunch: number;
}) {
  const items = args.items.map((item) => ({
    menuItemId: item.id,
    name: item.name,
    historical_sales: args.historicalMap[item.id] ?? [],
    pre_order_count: args.preOrderMap[item.id] ?? 0,
    day_of_week: args.dayOfWeek,
    is_weekend: args.isWeekend,
    days_since_launch: args.daysSinceLaunch,
    rolling_7d_avg: args.rolling7d[item.id] ?? 0,
    rolling_14d_avg: args.rolling14d[item.id] ?? 0,
  }));

  return {
    date: args.date,
    semester_period: args.semesterPeriod,
    items,
  };
}

describe("buildPayloadShape", () => {
  it("creates one item entry per menu item", () => {
    const payload = buildPayloadShape({
      date: "2026-08-30",
      semesterPeriod: "REGULAR_LECTURES",
      items: [{ id: "m1", name: "Rice" }, { id: "m2", name: "Kottu" }],
      historicalMap: { m1: [1, 2, 3], m2: [4, 5, 6] },
      rolling7d: { m1: 2, m2: 5 },
      rolling14d: { m1: 2.5, m2: 4.5 },
      preOrderMap: { m1: 1, m2: 2 },
      dayOfWeek: 1,
      isWeekend: false,
      daysSinceLaunch: 30,
    });
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0].menuItemId).toBe("m1");
    expect(payload.items[0].name).toBe("Rice");
    expect(payload.items[0].is_weekend).toBe(false);
  });

  it("defaults missing historical/rolling values to 0/[]", () => {
    const payload = buildPayloadShape({
      date: "2026-08-30",
      semesterPeriod: "REGULAR_LECTURES",
      items: [{ id: "new-item", name: "New" }],
      historicalMap: {},
      rolling7d: {},
      rolling14d: {},
      preOrderMap: {},
      dayOfWeek: 0,
      isWeekend: true,
      daysSinceLaunch: 0,
    });
    expect(payload.items[0].historical_sales).toEqual([]);
    expect(payload.items[0].rolling_7d_avg).toBe(0);
    expect(payload.items[0].is_weekend).toBe(true);
  });

  it("passes through semester period unchanged", () => {
    const payload = buildPayloadShape({
      date: "2026-08-30",
      semesterPeriod: "EXAM_PERIOD",
      items: [],
      historicalMap: {},
      rolling7d: {},
      rolling14d: {},
      preOrderMap: {},
      dayOfWeek: 0,
      isWeekend: false,
      daysSinceLaunch: 0,
    });
    expect(payload.semester_period).toBe("EXAM_PERIOD");
    expect(payload.date).toBe("2026-08-30");
  });
});
