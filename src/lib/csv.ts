/**
 * csv.ts — safe CSV export helpers.
 *
 * Security:
 * - Formula-injection neutralisation: any cell whose first character is
 *   `=`, `+`, `-`, `@`, TAB or CR is prefixed with a single quote `'`,
 *   so Excel/Sheets render it as text instead of executing a macro.
 * - UTF-8 BOM (`\uFEFF`) is prepended to every export so Sinhala (and
 *   other non-Latin) text opens cleanly in Excel.
 * - RFC 4180 quoting: cells containing `"`, `,`, `\n` or `\r` are
 *   wrapped in quotes with inner quotes doubled.
 */

const BOM = "\uFEFF";

/** Characters that trigger spreadsheet formula evaluation. */
const DANGEROUS_FIRST = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function sanitizeCsvCell(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) {
    text = "";
  } else if (value instanceof Date) {
    text = value.toISOString();
  } else {
    text = String(value);
  }

  // Neutralise formula injection BEFORE quoting.
  if (text.length > 0 && DANGEROUS_FIRST.has(text[0])) {
    text = `'${text}`;
  }

  // RFC 4180 quoting.
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(sanitizeCsvCell).join(","),
    ...rows.map((r) => r.map(sanitizeCsvCell).join(",")),
  ];
  // CRLF line endings (Excel-friendly) + BOM for UTF-8 detection.
  return BOM + lines.join("\r\n") + "\r\n";
}

export function csvFilename(prefix: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `${prefix}-${stamp}.csv`;
}
