import { expect, test } from "@playwright/test";
import { createLocalAccount } from "./helpers";

test.beforeEach(async ({ page }, testInfo) => {
  await createLocalAccount(page, `workflow-${testInfo.project.name}-${testInfo.workerIndex}`);
});

test("buyer can filter the marketplace and begin an NDA request", async ({ page }) => {
  await page.goto("/en/dashboard/marketplace");
  await expect(page.getByRole("heading", { name: "Businesses ready for serious buyers" })).toBeVisible();

  await page.getByLabel("Location").selectOption({ label: "Portland, OR" });
  await page.getByRole("button", { name: "Show matches" }).click();
  await expect(page).toHaveURL(/city=Portland%2C\+OR|city=Portland%2C%20OR/);
  await expect(page.locator(".marketplace-card")).toHaveCount(1);

  const listing = page.locator(".marketplace-card").first();
  await listing.locator("summary").click();
  await expect(listing.getByLabel("Message to broker")).toContainText("interested");
  await expect(listing.getByRole("button", { name: /Open NDA|Request NDA/ })).toBeVisible();
});

test("broker listing form is understandable and formats money", async ({ page }) => {
  await page.goto("/en/dashboard/listings?new=1#new-listing");
  await expect(page.getByRole("heading", { name: "Your business listings" })).toBeVisible();
  const flow = page.locator(".broker-flow");
  await expect(flow).toContainText("Create the listing");
  await expect(flow).toContainText("Add your standard NDA");
  await expect(flow).toContainText("Review serious buyers");

  const price = page.getByLabel("Asking price");
  await price.fill("1250000");
  await expect(price).toHaveValue("1,250,000");
  await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish listing" })).toBeVisible();
});
