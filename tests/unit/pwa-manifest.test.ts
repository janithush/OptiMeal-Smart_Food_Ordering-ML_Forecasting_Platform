import { describe, it, expect } from "vitest";
import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  const m = manifest();

  it("has installable core fields", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
  });

  it("ships 192px + 512px icons with a maskable entry", () => {
    const sizes = (m.icons ?? []).map((i) => `${i.sizes} ${i.purpose ?? "any"}`);
    expect(sizes.some((s) => s.startsWith("192x192"))).toBe(true);
    expect(sizes.some((s) => s.startsWith("512x512"))).toBe(true);
    expect(sizes.some((s) => s.includes("maskable"))).toBe(true);
  });
});
