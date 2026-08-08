/**
 * date-utils.ts — Colombo timezone date utilities.
 *
 * PURE utility — zero dependencies on Prisma, database, or Node.js APIs.
 * Safe to import from both Server Components, Client Components, and API routes.
 *
 * All date-sensitive logic MUST use these functions instead of raw UTC dates
 * so the system correctly rolls over at local midnight (Asia/Colombo, UTC+5:30).
 */

const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Get the current date in Colombo (Sri Lanka) timezone as a UTC midnight Date.
 *
 * Example: At 00:01 AM Colombo on Aug 9 → returns 2026-08-09T00:00:00.000Z
 * Example: At 11:59 PM Colombo on Aug 8 → returns 2026-08-08T00:00:00.000Z
 */
export function getTodayDate(): Date {
  const colomboNow = new Date(Date.now() + COLOMBO_OFFSET_MS);
  return new Date(
    Date.UTC(colomboNow.getUTCFullYear(), colomboNow.getUTCMonth(), colomboNow.getUTCDate())
  );
}

/**
 * Calculate tomorrow's date in Colombo timezone as a UTC midnight Date.
 */
export function getTomorrowDate(): Date {
  const today = getTodayDate();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow;
}

/**
 * Get today's date string in YYYY-MM-DD format in Colombo timezone.
 * Safe to use on both server and client (pure computation, no deps).
 */
export function getColomboDateString(): string {
  const colomboNow = new Date(Date.now() + COLOMBO_OFFSET_MS);
  const y = colomboNow.getUTCFullYear();
  const m = String(colomboNow.getUTCMonth() + 1).padStart(2, "0");
  const d = String(colomboNow.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

/**
 * Validate a stock entry date string against Colombo timezone:
 * - Cannot be more than 1 day in the past
 * - Cannot be in the future
 *
 * Returns null if valid, or an error message string.
 */
export function validateStockDate(dateStr: string): string | null {
  const entryDate = new Date(dateStr + "T00:00:00Z");
  const today = getTodayDate();

  const oneDayAgo = new Date(today);
  oneDayAgo.setUTCDate(oneDayAgo.getUTCDate() - 1);

  if (entryDate < oneDayAgo) {
    return "Stock entries cannot be backdated more than 1 day.";
  }

  if (entryDate > today) {
    return "Stock entries cannot be future-dated.";
  }

  return null;
}

/**
 * Validate stock amounts:
 * - openingStock must be >= 0
 * - receivedStock if provided must be >= 0
 * - consumedStock if provided must be >= 0
 * - closingStock if provided must be >= 0
 *
 * Returns null if valid, or an error message string.
 */
export function validateStockAmounts(
  openingStock: number,
  receivedStock: number | null,
  consumedStock: number | null,
  closingStock: number | null
): string | null {
  if (openingStock < 0) {
    return "Opening stock cannot be negative.";
  }
  if (receivedStock !== null && receivedStock < 0) {
    return "Received stock cannot be negative.";
  }
  if (consumedStock !== null && consumedStock < 0) {
    return "Consumed stock cannot be negative.";
  }
  if (closingStock !== null && closingStock < 0) {
    return "Closing stock cannot be negative.";
  }
  return null;
}
