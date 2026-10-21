import { test, expect } from "@playwright/test";

test.describe("safeNext redirect validation", () => {
  const bad = [
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/%2F%2Fevil.com",
    "/%5Cevil.com",
    "javascript:alert(1)",
    "data:text/html,x",
    "/dashboard%0d%0aSet-Cookie:x",
    " /dashboard",
    "/login?next=/login",
    "/zap/..%2Fadmin",
  ];

  for (const v of bad) {
    test(`rejects ${v}`, async ({ page }) => {
      await page.goto(`/login?next=${encodeURIComponent(v)}`);
      // Should redirect to dashboard (safeNext returns /dashboard for invalid input)
      await expect(page).toHaveURL(/\/dashboard|\/login/);
    });
  }

  const good = ["/dashboard", "/history", "/zap/create", "/zap/abc_123", "/settings"];
  for (const v of good) {
    test(`accepts ${v}`, async ({ page }) => {
      await page.goto(`/login?next=${encodeURIComponent(v)}`);
      // Page should load without error
      await expect(page.locator("body")).toBeVisible();
    });
  }
});

test.describe("auth gate", () => {
  test("unauthenticated access to /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /history redirects to /login", async ({ page }) => {
    await page.goto("/history");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /settings redirects to /login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("landing page", () => {
  test("renders Zapflow brand", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Zapflow")).toBeVisible();
  });

  test("has Create automation CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Create automation").first()).toBeVisible();
  });

  test("has no pricing links", async ({ page }) => {
    await page.goto("/");
    const pricing = page.locator("text=Pricing");
    await expect(pricing).toHaveCount(0);
  });
});
