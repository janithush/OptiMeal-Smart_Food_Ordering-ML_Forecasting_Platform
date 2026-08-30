import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Enforce `const`/`let` over `var` everywhere in the repo.
      "no-var": "error",
      // Prefer const where reassignment is not required.
      "prefer-const": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma client
    "src/generated/**",
    // Auto-generated test artifacts. These directories contain large
    // embedded JSON and binary `.zip` trace files (Playwright writes
    // multi-MB trace archives). When ESLint tries to parse them as
    // JavaScript, Babel throws `RangeError: Invalid string length`
    // because the content exceeds the parser's buffer. They are never
    // edited by hand, so it's safe to ignore them globally.
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
