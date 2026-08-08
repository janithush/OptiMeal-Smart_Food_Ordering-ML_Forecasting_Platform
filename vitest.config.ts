/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vitest configuration for CaféSmart unit & component tests.
 *
 * Run unit tests:     npx vitest run
 * Run with watch:     npx vitest
 * Run with UI:        npx vitest --ui
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/support/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
    },
    reporters: process.env.CI
      ? ["default", "junit"]
      : ["default"],
    outputFile: {
      junit: "test-results/unit-junit.xml",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
