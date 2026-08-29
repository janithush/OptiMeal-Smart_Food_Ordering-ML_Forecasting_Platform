import crypto from "crypto";

function getBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return raw.startsWith("http") ? raw : `http://${raw}`;
}

function getMerchantId(): string {
  return process.env.PAYHERE_MERCHANT_ID ?? "";
}

function getMerchantSecret(): string {
  return process.env.PAYHERE_MERCHANT_SECRET ?? "";
}

export interface PayHereFormData {
  actionUrl: string;
  fields: Record<string, string>;
}

/**
 * Build form data for PayHere hosted checkout POST.
 * Student fills amount → server returns form fields → client auto-submits.
 */
export function buildPayHereFormData(
  amount: number,
  studentId: string,
  studentEmail: string,
  studentName: string,
  studentPhone?: string | null
): PayHereFormData {
  const orderId = `CAF-TOPUP-${studentId}-${Date.now()}`;
  const baseUrl = getBaseUrl();
  const first = studentName.split(" ")[0] || studentName;
  const last = studentName.split(" ").slice(1).join(" ") || first;
  const merchantId = getMerchantId();
  const merchantSecret = getMerchantSecret();
  const amountStr = amount.toFixed(2);
  const currency = "LKR";

  // PayHere checkout integrity hash:
  // MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret).upper())
  const secretHash = crypto.createHash("md5").update(merchantSecret).digest("hex").toUpperCase();
  const hash = crypto.createHash("md5")
    .update(merchantId + orderId + amountStr + currency + secretHash)
    .digest("hex")
    .toUpperCase();

  return {
    actionUrl: "https://sandbox.payhere.lk/pay/checkout",
    fields: {
      merchant_id: merchantId,
      return_url: `${baseUrl}/student/wallet?topup=success`,
      cancel_url: `${baseUrl}/student/wallet?topup=cancelled`,
      notify_url: `${baseUrl}/api/wallet/webhook`,
      order_id: orderId,
      items: "CaféSmart Wallet Top-Up",
      currency,
      amount: amountStr,
      first_name: first,
      last_name: last,
      email: studentEmail,
      phone: studentPhone || "0700000000",
      address: "University of Ruhuna",
      city: "Matara",
      country: "Sri Lanka",
      hash,
    },
  };
}

/**
 * Verify PayHere HMAC-MD5 signature for CHECKOUT requests.
 * Formula: MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret).upper()).upper()
 */
export function verifyPayHereSignature(
  orderId: string,
  amount: string,
  currency: string,
  receivedHash: string
): boolean {
  const secretHash = crypto.createHash("md5").update(getMerchantSecret()).digest("hex").toUpperCase();
  const data = getMerchantId() + orderId + amount + currency + secretHash;
  const computed = crypto.createHash("md5").update(data).digest("hex").toUpperCase();
  return computed === receivedHash.toUpperCase();
}

/**
 * Verify PayHere HMAC-MD5 signature for WEBHOOK callbacks.
 * Webhook formula: MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret).upper()).upper()
 */
export function verifyPayHereWebhookSignature(
  orderId: string,
  amount: string,
  currency: string,
  statusCode: string,
  receivedHash: string
): boolean {
  const secretHash = crypto.createHash("md5").update(getMerchantSecret()).digest("hex").toUpperCase();
  const data = getMerchantId() + orderId + amount + currency + statusCode + secretHash;
  const computed = crypto.createHash("md5").update(data).digest("hex").toUpperCase();
  return computed === receivedHash.toUpperCase();
}

/**
 * Compute the PayHere webhook HMAC locally. Useful for tests and for
 * re-validating an incoming callback against the raw form body (which
 * is what PayHere actually signs).
 *
 * PayHere signs the body as:
 *   MD5( merchant_id + order_id + payhere_amount + payhere_currency
 *        + status_code + MD5(merchant_secret).upper() ).upper()
 *
 * IMPORTANT: The hash is over the raw form-encoded values, NOT over a
 * re-serialised JS object. The webhook handler MUST call this with the
 * values exactly as they appear in the POST body.
 */
export function computePayHereWebhookSignature(
  merchantId: string,
  merchantSecret: string,
  orderId: string,
  amount: string,
  currency: string,
  statusCode: string
): string {
  const secretHash = crypto.createHash("md5").update(merchantSecret).digest("hex").toUpperCase();
  const data = merchantId + orderId + amount + currency + statusCode + secretHash;
  return crypto.createHash("md5").update(data).digest("hex").toUpperCase();
}

/**
 * Verify a PayHere webhook by recomputing the HMAC over the supplied
 * values. The caller is expected to have parsed `merchant_id`,
 * `order_id`, `payhere_amount`, `payhere_currency`, `status_code`, and
 * `md5sig` directly from the raw form body — NOT from a re-serialised
 * representation, which can alter the canonical string and cause a
 * mismatch.
 */
export function verifyPayHereWebhookRaw(
  merchantId: string,
  orderId: string,
  payhereAmount: string,
  payhereCurrency: string,
  statusCode: string,
  receivedHash: string
): boolean {
  const secret = getMerchantSecret();
  if (!secret) return false;
  const computed = computePayHereWebhookSignature(
    merchantId,
    secret,
    orderId,
    payhereAmount,
    payhereCurrency,
    statusCode
  );
  // Constant-time comparison to avoid timing leaks on the signature.
  if (computed.length !== receivedHash.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(computed, "utf8"),
    Buffer.from(receivedHash.toUpperCase(), "utf8")
  );
}

/**
 * Parse an `application/x-www-form-urlencoded` body string into a
 * `Record<string, string>` without using the Web `URLSearchParams` class,
 * so it works in both Node and Edge runtimes and preserves values byte
 * for byte (decoded exactly once).
 */
export function parseFormUrlEncoded(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const segment of raw.split("&")) {
    if (!segment) continue;
    const eq = segment.indexOf("=");
    const rawKey = eq === -1 ? segment : segment.slice(0, eq);
    const rawVal = eq === -1 ? "" : segment.slice(eq + 1);
    try {
      out[decodeURIComponent(rawKey.replace(/\+/g, " "))] = decodeURIComponent(
        rawVal.replace(/\+/g, " ")
      );
    } catch {
      // Skip malformed segments — PayHere will never send one, so this
      // only triggers on corrupted bodies.
    }
  }
  return out;
}

/**
 * Extract userId from a PayHere order_id of format CAF-TOPUP-{userId}-{timestamp}
 */
export function extractUserIdFromOrderId(orderId: string): string | null {
  const parts = orderId.split("-");
  if (parts.length < 4) return null;
  const lastPart = parts[parts.length - 1];
  if (!/^\d+$/.test(lastPart)) return null;
  return parts.slice(2, parts.length - 1).join("-");
}
