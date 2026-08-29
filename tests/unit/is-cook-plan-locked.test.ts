/**
 * Unit tests for the pure helper `isCookPlanLocked` in src/lib/cook-plan.ts.
 *
 * `isCookPlanLocked` evaluates:
 *   status === "CONFIRMED" AND Colombo local time is past 10:00 AM.
 *
 * Run: npx vitest run tests/unit/is-cook-plan-locked.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isCookPlanLocked } from "@/lib/cook-plan";

describe("isCookPlanLocked", () => {
  const realDate = global.Date;

  function mockColomboNow(hourColombo: number, minuteColombo: number) {
    // Build a fixed UTC instant whose Colombo (UTC+5:30) hour is the
    // desired value. We pick a known UTC reference and adjust minutes.
    // Colombo = UTC + 5h30, so UTC = Colombo - 5:30.
    const utcHour = (hourColombo - 5 + 24) % 24;
    const utcMinute = (minuteColombo - 30 + 60) % 60;
    // 2026-08-30 12:00 UTC
    const fake = new realDate(Date.UTC(2026, 7, 30, utcHour, utcMinute, 0));
    vi.useFakeTimers();
    vi.setSystemTime(fake);
  }

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for SUGGESTED regardless of time", () => {
    mockColomboNow(11, 0);
    expect(isCookPlanLocked("SUGGESTED")).toBe(false);
  });

  it("returns false for CONFIRMED before 10:00 AM Colombo", () => {
    mockColomboNow(9, 59);
    expect(isCookPlanLocked("CONFIRMED")).toBe(false);
  });

  it("returns true for CONFIRMED at 10:00 AM Colombo exactly", () => {
    mockColomboNow(10, 0);
    expect(isCookPlanLocked("CONFIRMED")).toBe(true);
  });

  it("returns true for CONFIRMED at 12:30 PM Colombo", () => {
    mockColomboNow(12, 30);
    expect(isCookPlanLocked("CONFIRMED")).toBe(true);
  });

  it("returns true for SUPERSEDED (not CONFIRMED) — false", () => {
    mockColomboNow(14, 0);
    expect(isCookPlanLocked("SUPERSEDED")).toBe(false);
  });
});
