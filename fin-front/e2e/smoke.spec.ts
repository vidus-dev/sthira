import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("landing page loads", async ({ page }) => {
    const resp = await page.goto("/");
    expect(resp?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
  });

  test("login page renders the sign-in form", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("can navigate from login to register", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("link", { name: "Register" }).click();
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  });
});
