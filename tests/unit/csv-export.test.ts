import { describe, it, expect } from "vitest";
import { sanitizeCsvCell, toCsv } from "@/lib/csv";

describe("sanitizeCsvCell", () => {
  it("prefixes formula cells with a single quote", () => {
    expect(sanitizeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(sanitizeCsvCell("+500")).toBe("'+500");
    expect(sanitizeCsvCell("-2+3")).toBe("'-2+3");
    expect(sanitizeCsvCell("@mention")).toBe("'@mention");
    expect(sanitizeCsvCell("\tINDIRECT(A1)")).toBe("'\tINDIRECT(A1)");
  });

  it("leaves safe text untouched", () => {
    expect(sanitizeCsvCell("Chicken Rice")).toBe("Chicken Rice");
    expect(sanitizeCsvCell("Rs.250.00")).toBe("Rs.250.00");
    expect(sanitizeCsvCell("කඩලunch")).toBe("කඩලunch");
    expect(sanitizeCsvCell(42)).toBe("42");
    expect(sanitizeCsvCell(null)).toBe("");
  });

  it("applies RFC 4180 quoting with doubled quotes", () => {
    expect(sanitizeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(sanitizeCsvCell("a,b")).toBe('"a,b"');
  });
});

describe("toCsv", () => {
  it("prepends a UTF-8 BOM and uses CRLF endings", () => {
    const out = toCsv(["Name", "Note"], [["අම්මා", "=1+1"]]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain("\r\n");
    expect(out).toContain("'=1+1");
  });
});
