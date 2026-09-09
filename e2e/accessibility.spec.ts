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

test("skip navigation reaches the main content by keyboard", async ({ page }) => {
  await page.goto("/en");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("authenticated critical workspaces meet the accessibility release gate", async ({ page }, testInfo) => {
  await createLocalAccount(page, `a11y-workspaces-${testInfo.project.name}`);
  for (const route of ["/en/dashboard", "/en/dashboard/inbox", "/en/dashboard/tasks", "/en/dashboard/reports", "/en/dashboard/documents", "/en/dashboard/settings", "/en/dashboard/feedback"]) {
    await page.goto(route);
    await expect(page.locator(".sidebar-nav a[aria-current='page']")).toHaveCount(1);
    await expectAccessible(page);
  }
});

test("mobile dashboard navigation is keyboard operable", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile navigation is displayed only at the mobile breakpoint.");
  await createLocalAccount(page, `a11y-mobile-nav-${testInfo.project.name}`);
  const menu = page.locator(".mobile-nav summary");
  await menu.focus();
  await expect(menu).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".mobile-nav")).toHaveAttribute("open", "");
  await expect(page.locator(".mobile-nav a[aria-current='page']")).toHaveCount(1);
});

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
