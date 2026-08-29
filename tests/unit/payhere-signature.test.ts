/**
 * Unit tests for src/lib/payhere.ts — HMAC and form parsing.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

import {
  computePayHereWebhookSignature,
  verifyPayHereWebhookRaw,
  parseFormUrlEncoded,
  extractUserIdFromOrderId,
  verifyPayHereWebhookSignature,
  verifyPayHereSignature,
  buildPayHereFormData,
} from "@/lib/payhere";

const TEST_MERCHANT_ID = "1211111";
const TEST_MERCHANT_SECRET = "TEST-SECRET-1234567890";

beforeEach(() => {
  process.env.PAYHERE_MERCHANT_ID = TEST_MERCHANT_ID;
  process.env.PAYHERE_MERCHANT_SECRET = TEST_MERCHANT_SECRET;
  process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
});

afterEach(() => {
  delete process.env.PAYHERE_MERCHANT_ID;
  delete process.env.PAYHERE_MERCHANT_SECRET;
});

describe("computePayHereWebhookSignature", () => {
  it("matches the documented PayHere formula", () => {
    const secretHash = crypto
      .createHash("md5")
      .update(TEST_MERCHANT_SECRET)
      .digest("hex")
      .toUpperCase();
    const data =
      TEST_MERCHANT_ID + "CAF-TOPUP-user-1-1700000000" + "1000.00" + "LKR" + "2" + secretHash;
    const expected = crypto.createHash("md5").update(data).digest("hex").toUpperCase();
    const actual = computePayHereWebhookSignature(
      TEST_MERCHANT_ID,
      TEST_MERCHANT_SECRET,
      "CAF-TOPUP-user-1-1700000000",
      "1000.00",
      "LKR",
      "2"
    );
    expect(actual).toBe(expected);
    expect(actual).toMatch(/^[A-F0-9]{32}$/);
  });

  it("produces a different hash when amount changes by 0.01", () => {
    const a = computePayHereWebhookSignature(
      TEST_MERCHANT_ID, TEST_MERCHANT_SECRET, "order-1", "100.00", "LKR", "2"
    );
    const b = computePayHereWebhookSignature(
      TEST_MERCHANT_ID, TEST_MERCHANT_SECRET, "order-1", "100.01", "LKR", "2"
    );
    expect(a).not.toBe(b);
  });
});

describe("verifyPayHereWebhookRaw", () => {
  it("accepts a freshly-computed signature", () => {
    const sig = computePayHereWebhookSignature(
      TEST_MERCHANT_ID, TEST_MERCHANT_SECRET, "order-1", "500.00", "LKR", "2"
    );
    expect(verifyPayHereWebhookRaw(TEST_MERCHANT_ID, "order-1", "500.00", "LKR", "2", sig)).toBe(true);
  });

  it("rejects when status code is tampered", () => {
    const sig = computePayHereWebhookSignature(
      TEST_MERCHANT_ID, TEST_MERCHANT_SECRET, "order-1", "500.00", "LKR", "2"
    );
    expect(verifyPayHereWebhookRaw(TEST_MERCHANT_ID, "order-1", "500.00", "LKR", "0", sig)).toBe(false);
  });

  it("rejects when amount is tampered", () => {
    const sig = computePayHereWebhookSignature(
      TEST_MERCHANT_ID, TEST_MERCHANT_SECRET, "order-1", "500.00", "LKR", "2"
    );
    expect(verifyPayHereWebhookRaw(TEST_MERCHANT_ID, "order-1", "5000.00", "LKR", "2", sig)).toBe(false);
  });

  it("returns false when no secret is configured", () => {
    delete process.env.PAYHERE_MERCHANT_SECRET;
    expect(verifyPayHereWebhookRaw(TEST_MERCHANT_ID, "order-1", "1.00", "LKR", "2", "X".repeat(32))).toBe(false);
  });

  it("accepts lowercase received hash", () => {
    const sig = computePayHereWebhookSignature(
      TEST_MERCHANT_ID, TEST_MERCHANT_SECRET, "order-1", "500.00", "LKR", "2"
    );
    expect(verifyPayHereWebhookRaw(TEST_MERCHANT_ID, "order-1", "500.00", "LKR", "2", sig.toLowerCase())).toBe(true);
  });

  it("returns false when hash length differs", () => {
    expect(verifyPayHereWebhookRaw(TEST_MERCHANT_ID, "order-1", "1.00", "LKR", "2", "tooshort")).toBe(false);
  });
});

describe("parseFormUrlEncoded", () => {
  it("parses key=value pairs", () => {
    expect(parseFormUrlEncoded("a=1&b=2")).toEqual({ a: "1", b: "2" });
  });

  it("decodes percent-encoded characters", () => {
    expect(parseFormUrlEncoded("order_id=CAF-TOPUP%2Fuser%2D1%2D1234")).toEqual({
      order_id: "CAF-TOPUP/user-1-1234",
    });
  });

  it("decodes plus as space", () => {
    expect(parseFormUrlEncoded("name=John+Doe")).toEqual({ name: "John Doe" });
  });

  it("handles empty values", () => {
    expect(parseFormUrlEncoded("a=&b=2")).toEqual({ a: "", b: "2" });
  });

  it("returns empty object for empty input", () => {
    expect(parseFormUrlEncoded("")).toEqual({});
  });
});

describe("extractUserIdFromOrderId", () => {
  it("extracts UUID-style userId", () => {
    expect(extractUserIdFromOrderId("CAF-TOPUP-abc-123-def-456-1700000000")).toBe("abc-123-def-456");
  });

  it("returns null for non-numeric timestamp", () => {
    expect(extractUserIdFromOrderId("CAF-TOPUP-user-1-notatimestamp")).toBeNull();
  });

  it("returns null for too-few segments", () => {
    expect(extractUserIdFromOrderId("CAF-TOPUP-user")).toBeNull();
  });

  it("preserves hyphens in the userId portion", () => {
    expect(extractUserIdFromOrderId("CAF-TOPUP-janith-r-s-1700000000")).toBe("janith-r-s");
  });
});

describe("verifyPayHereWebhookSignature (legacy compat)", () => {
  it("accepts a valid signature for status_code=2", () => {
    const sig = computePayHereWebhookSignature(
      TEST_MERCHANT_ID, TEST_MERCHANT_SECRET, "order-1", "500.00", "LKR", "2"
    );
    expect(verifyPayHereWebhookSignature("order-1", "500.00", "LKR", "2", sig)).toBe(true);
  });
});

describe("verifyPayHereSignature (checkout)", () => {
  it("round-trips with buildPayHereFormData", () => {
    const form = buildPayHereFormData(1000, "user-abc", "user@example.com", "John Doe");
    expect(
      verifyPayHereSignature(
        form.fields.order_id, form.fields.amount, form.fields.currency, form.fields.hash
      )
    ).toBe(true);
  });
});
