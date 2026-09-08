import { expect, type Page } from "@playwright/test";

export async function createLocalAccount(page: Page, suffix: string) {
  await page.goto("/en/create-account");
  await page.getByLabel("Your name").fill(`Crestview ${suffix}`);
  await page.getByLabel("Email").fill(`${suffix.toLowerCase()}@crestview.test`);
  await page.getByLabel("Password").fill("Crestview-test-2026");
  await page.locator("form").getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Your acquisition overview" })).toBeVisible({ timeout: 20_000 });
}
