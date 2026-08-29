/**
 * Test-only helpers for building dates in the Asia/Colombo timezone.
 *
 * The CaféSmart application is strictly localized to Sri Lanka — every
 * production date helper operates in UTC+5:30. **Tests MUST do the
 * same**: any test that constructs a `YYYY-MM-DD` string with
 * `Date.UTC(...)` or `new Date().toISOString().split("T")[0]` is
 * inherently UTC-relative and will produce a wrong answer for ~5 hours
 * of every day (the Colombo/UTC offset window).
 *
 * These helpers mirror the production logic in
 * `src/lib/date-utils.ts` so tests stay byte-for-byte aligned.
 *
 * If you find yourself reaching for `new Date()` or `Date.UTC()` in a
 * test that asserts a date, use one of these helpers instead.
 */

const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** The Date that `getTodayDate()` would return *right now* in Colombo. */
export function getColomboTodayDate(): Date {
  const colomboNow = new Date(Date.now() + COLOMBO_OFFSET_MS);
  return new Date(
    Date.UTC(colomboNow.getUTCFullYear(), colomboNow.getUTCMonth(), colomboNow.getUTCDate())
  );
}

/** "YYYY-MM-DD" for today, in Colombo time. */
export function getColomboTodayString(): string {
  const d = getColomboTodayDate();
  return formatColomboDate(d);
}

/**
 * Build a UTC-midnight Date for `offsetDays` from today in Colombo time.
 * `offsetDays = 0` → today; `-1` → yesterday; `+1` → tomorrow.
 *
 * Matches the contract of `getTodayDate()` / `getTomorrowDate()` in
 * `src/lib/date-utils.ts`.
 */
export function getColomboOffsetDate(offsetDays: number): Date {
  const today = getColomboTodayDate();
  const out = new Date(today);
  out.setUTCDate(out.getUTCDate() + offsetDays);
  return out;
}

/** "YYYY-MM-DD" for `offsetDays` from today, in Colombo time. */
export function getColomboOffsetString(offsetDays: number): string {
  return formatColomboDate(getColomboOffsetDate(offsetDays));
}

function formatColomboDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
