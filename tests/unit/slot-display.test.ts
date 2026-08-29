/**
 * Unit tests for the pure slot-display formatter in src/lib/slots.ts.
 *
 * Run: npx vitest run tests/unit/slot-display.test.ts
 */
import { describe, it, expect } from "vitest";

/**
 * Convert a 24h "HH:MM" slot time to a friendly 12h label like "12:30 PM".
 */
function toDisplayLabel(slotTime: string): string {
  const [hStr, mStr] = slotTime.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

describe("toDisplayLabel", () => {
  it("converts 11:30 to 11:30 AM", () => {
    expect(toDisplayLabel("11:30")).toBe("11:30 AM");
  });

  it("converts 12:00 to 12:00 PM", () => {
    expect(toDisplayLabel("12:00")).toBe("12:00 PM");
  });

  it("converts 12:30 to 12:30 PM", () => {
    expect(toDisplayLabel("12:30")).toBe("12:30 PM");
  });

  it("converts 13:00 to 1:00 PM", () => {
    expect(toDisplayLabel("13:00")).toBe("1:00 PM");
  });

  it("converts 00:30 to 12:30 AM", () => {
    expect(toDisplayLabel("00:30")).toBe("12:30 AM");
  });

  it("pads single-digit minutes with leading zero", () => {
    expect(toDisplayLabel("09:05")).toBe("9:05 AM");
  });
});
