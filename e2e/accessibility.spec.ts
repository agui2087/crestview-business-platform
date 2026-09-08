import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createLocalAccount } from "./helpers";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const summary = results.violations
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)
    .join("\n");
  expect(results.violations, summary).toEqual([]);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);

  const viewportOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(viewportOverflow, "The page must not scroll horizontally at this viewport").toBe(false);
}

for (const route of ["/en", "/en/how-it-works", "/en/pricing", "/en/sign-in", "/en/create-account"]) {
  test(`public page ${route} meets the accessibility release gate`, async ({ page }) => {
    await page.goto(route);
    await expectAccessible(page);
  });
}

test("buyer marketplace meets the accessibility release gate", async ({ page }, testInfo) => {
  await createLocalAccount(page, `a11y-marketplace-${testInfo.project.name}`);
  await page.goto("/en/dashboard/marketplace");
  await expect(page.getByRole("heading", { name: "Businesses ready for serious buyers" })).toBeVisible();
  await expectAccessible(page);
});

test("broker listing workspace meets the accessibility release gate", async ({ page }, testInfo) => {
  await createLocalAccount(page, `a11y-listing-${testInfo.project.name}`);
  await page.goto("/en/dashboard/listings?new=1#new-listing");
  await expect(page.getByRole("heading", { name: "Your business listings" })).toBeVisible();
  await expectAccessible(page);
});
