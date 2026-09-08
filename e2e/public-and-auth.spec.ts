import { expect, test } from "@playwright/test";
import { createLocalAccount } from "./helpers";

test("a new visitor can create an account, stay signed in, and sign out", async ({ page }, testInfo) => {
  await createLocalAccount(page, `buyer-${testInfo.project.name}`);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your acquisition overview" })).toBeVisible();

  await page.locator('summary[aria-label="Open account menu"]').click();
  await page.getByRole("link", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/en$/);

  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/sign-in/, { timeout: 30_000 });
});

test("public navigation exposes the core Crestview journey", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("body")).toContainText("Crestview");
  await expect(page.getByRole("link", { name: /How it works/i }).first()).toBeVisible();
  await page.goto("/en/how-it-works");
  await expect(page.getByRole("heading", { name: /Buying a business/i })).toBeVisible();
  await page.goto("/en/pricing");
  await expect(page.locator("main")).toContainText(/Free|Pro|Broker/);
});
