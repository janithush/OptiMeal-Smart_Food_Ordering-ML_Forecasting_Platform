/* eslint-disable react-hooks/rules-of-hooks */
/**
 * Playwright test fixtures for CaféSmart.
 *
 * Extends base Playwright fixtures with auth helpers,
 * API request context, and test data factories.
 *
 * Note: eslint-disable for react-hooks/rules-of-hooks — Playwright's `use`
 * callback in `test.extend()` is not React's `use` hook.
 */
import { test as base, request, APIRequestContext, Page } from "@playwright/test";
import { createTestUser, createTestIngredient, createTestInventoryRecord } from "../factories/data-factory";
import type { TestUser, TestIngredient, TestInventoryRecord } from "../factories/data-factory";

// ---------------------------------------------------------------------------
// Fixture types
// ---------------------------------------------------------------------------

export type CafeSmartFixtures = {
  /** Pre-authenticated API request context (admin) */
  adminApi: APIRequestContext;
  /** Pre-authenticated API request context (student) */
  studentApi: APIRequestContext;
  /** Unauthenticated API request context */
  anonApi: APIRequestContext;
  /** Create a test user in the database */
  createUser: (overrides?: Partial<TestUser>) => TestUser;
  /** Create a test ingredient */
  createIngredient: (overrides?: Partial<TestIngredient>) => TestIngredient;
  /** Create a test inventory record */
  createInventoryRecord: (overrides?: Partial<TestInventoryRecord>) => TestInventoryRecord;
};

// ---------------------------------------------------------------------------
// Auth setup helpers
// ---------------------------------------------------------------------------

/**
 * Simulate an authenticated session by setting a mock JWT cookie.
 * This avoids needing a real Google OAuth flow in tests.
 *
 * In CI, you can alternatively seed a session token directly.
 */
async function setupAuthCookie(page: Page) {
  // For local tests with a running NextAuth instance, we use a pre-seeded
  // session. In CI, use a mock approach or a test-only login endpoint.
  //
  // Example: POST /api/auth/test-login { role: "ADMIN" } → sets session cookie
  const apiContext = await request.newContext({
    baseURL: process.env.API_URL ?? "http://localhost:3000",
  });

  // Attempt test-login (if the endpoint exists in the app)
  const res = await apiContext.post("/api/auth/callback/credentials", {
    data: {
      callbackUrl: "/",
      redirect: false,
    },
  });

  if (res.ok()) {
    const cookies = res.headers()["set-cookie"];
    if (cookies) {
      await page.context().addCookies(
        cookies.split(";").map((c) => {
          const [name, value] = c.trim().split("=");
          return { name, value, domain: "localhost", path: "/" };
        })
      );
    }
  }

  await apiContext.dispose();
}

// ---------------------------------------------------------------------------
// Extended test fixture
// ---------------------------------------------------------------------------

export const test = base.extend<CafeSmartFixtures>({
  // --- API request contexts ---

  adminApi: async ({}, use) => {
    const ctx = await request.newContext({
      baseURL: process.env.API_URL ?? "http://localhost:3000",
      extraHTTPHeaders: {
        // Mock admin JWT — replace with real token in CI
        "x-test-role": "ADMIN",
      },
    });
    await use(ctx);
    await ctx.dispose();
  },

  studentApi: async ({}, use) => {
    const ctx = await request.newContext({
      baseURL: process.env.API_URL ?? "http://localhost:3000",
      extraHTTPHeaders: {
        "x-test-role": "STUDENT",
      },
    });
    await use(ctx);
    await ctx.dispose();
  },

  anonApi: async ({}, use) => {
    const ctx = await request.newContext({
      baseURL: process.env.API_URL ?? "http://localhost:3000",
    });
    await use(ctx);
    await ctx.dispose();
  },

  // --- Data factories ---

  createUser: async ({}, use) => {
    await use((overrides) => createTestUser(overrides));
  },

  createIngredient: async ({}, use) => {
    await use((overrides) => createTestIngredient(overrides));
  },

  createInventoryRecord: async ({}, use) => {
    await use((overrides) => createTestInventoryRecord(overrides));
  },

  // --- Page with auth ---
  page: async ({ page }, use) => {
    // Default: no auth. Individual tests call setupAuthCookie as needed.
    await use(page);
  },
});

export { setupAuthCookie };
export { expect } from "@playwright/test";
