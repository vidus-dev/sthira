import { expect, test } from "@playwright/test";

/**
 * Full-stack auth flow against the running web+api stack. Registers a fresh user
 * (unique email per run), expects redirect into the authenticated app, and
 * verifies the session survives a reload.
 */
test("register a new user and land in the app", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "e2e-pw-123456";

  await page.goto("/auth/register");
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill(password);
  await page.getByRole("button", { name: /create account/i }).click();

  // Redirects into the protected app on success.
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });

  // Session persists across a hard reload (cookie-based session).
  await page.reload();
  await expect(page).toHaveURL(/\/app\//);
});

test("unauthenticated visit to a protected route redirects to login", async ({ page }) => {
  await page.goto("/app/accounts");
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 });
});
