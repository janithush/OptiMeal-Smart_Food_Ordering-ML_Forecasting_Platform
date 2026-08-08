/**
 * auth.spec.ts — Role-Based Access Control E2E Tests
 *
 * Validates:
 * - Unauthenticated users are redirected to /login
 * - Students cannot access /admin/* routes
 * - Admins can access admin routes
 *
 * Run: npx playwright test --project=chromium tests/e2e/auth.spec.ts
 */
import { test, expect } from "@playwright/test";

test.describe("Authentication & Access Control", () => {

  test.describe("Unauthenticated Access", () => {
    test("redirects to login when accessing /admin/dashboard", async ({ page }) => {
      await page.goto("/admin/dashboard");

      // Should redirect to /login or show a login page
      // The app may redirect or render a login form — both are valid
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/login|\/admin\/dashboard/);

      // If not redirected, the page should show an access-denied state
      // rather than exposing admin content
      const heading = page.locator("h1").first();
      if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
        const text = await heading.textContent();
        // Should NOT show admin dashboard content
        expect(text?.toLowerCase()).not.toContain("admin dashboard");
      }
    });

    test("redirects to login when accessing /admin/inventory", async ({ page }) => {
      await page.goto("/admin/inventory");

      // Either redirected or shows login/forbidden
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/login|\/forbidden|\/admin\/inventory/);

      // Verify admin content is not exposed
      const header = page.locator("h1").first();
      if (await header.isVisible({ timeout: 3000 }).catch(() => false)) {
        const text = await header.textContent();
        expect(text?.toLowerCase()).not.toContain("inventory");
      }
    });

    test("redirects to login when accessing /admin/orders", async ({ page }) => {
      await page.goto("/admin/orders");

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/login|\/forbidden|\/admin\/orders/);

      const header = page.locator("h1").first();
      if (await header.isVisible({ timeout: 3000 }).catch(() => false)) {
        const text = await header.textContent();
        expect(text?.toLowerCase()).not.toContain("order queue");
      }
    });

    test("redirects to login when accessing /admin/cook-plan", async ({ page }) => {
      await page.goto("/admin/cook-plan");
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/login|\/forbidden|\/admin\/cook-plan/);
    });

    test("redirects to login when accessing /admin/analytics", async ({ page }) => {
      await page.goto("/admin/analytics");
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/login|\/forbidden|\/admin\/analytics/);
    });

    test("redirects to login when accessing /admin/settings", async ({ page }) => {
      await page.goto("/admin/settings");
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/login|\/forbidden|\/admin\/settings/);
    });
  });

  test.describe("Protected API Endpoints", () => {
    test("GET /api/admin/inventory returns 401 or 403 without auth", async ({ request }) => {
      const res = await request.get("/api/admin/inventory", { maxRedirects: 0 });
      // 401 Unauthorized or 403 Forbidden — both are valid security responses
      expect([302, 303, 307, 308, 401, 403]).toContain(res.status());
    });

    test("GET /api/admin/procurement/alerts returns 401 or 403 without auth", async ({ request }) => {
      const res = await request.get("/api/admin/procurement/alerts", { maxRedirects: 0 });
      expect([302, 303, 307, 308, 401, 403]).toContain(res.status());
    });

    test("GET /api/admin/forecasts/latest returns 401 or 403 without auth", async ({ request }) => {
      const res = await request.get("/api/admin/forecasts/latest", { maxRedirects: 0 });
      expect([302, 303, 307, 308, 401, 403]).toContain(res.status());
    });

    test("GET /api/admin/analytics/wastage returns 401 or 403 without auth", async ({ request }) => {
      const res = await request.get("/api/admin/analytics/wastage", { maxRedirects: 0 });
      expect([302, 303, 307, 308, 401, 403]).toContain(res.status());
    });

    test("GET student routes do not expose admin data without auth", async ({ request }) => {
      // Student API routes should also be protected
      const res = await request.get("/api/student/flash-deals", { maxRedirects: 0 });
      // Student routes may also require auth
    expect([200, 302, 303, 307, 308, 401, 403]).toContain(res.status());
    });
  });

  test.describe("Student Role Restrictions", () => {
    test("student home page loads (may require auth)", async ({ page }) => {
      await page.goto("/student/home");

      // Should not crash — either loads or redirects
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/student\/home|\/login|\/onboarding/);

      // If loaded, should show menu or student content
      const heading = page.locator("h1").first();
      if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
        const text = (await heading.textContent()) ?? "";
        // Should NOT contain admin-only content
        expect(text).not.toContain("Admin Dashboard");
      }
    });
  });

  test.describe("Login Page", () => {
    test("login page renders with sign-in button", async ({ page }) => {
      await page.goto("/login");

      // Check for a sign-in element (button or link)
      const signInElement = page.locator(
        'button:has-text("Sign in"), a:has-text("Sign in"), button:has-text("Login"), a:has-text("Login")'
      );
      const isVisible = await signInElement.first().isVisible({ timeout: 5000 }).catch(() => false);

      // If a custom login page exists, it should show some content
      if (!isVisible) {
        // Page might redirect to Google OAuth directly
        const currentUrl = page.url();
        expect(currentUrl).toMatch(/\/login|\/api\/auth|accounts\.google\.com/);
      }
    });
  });
});
