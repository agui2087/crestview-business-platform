import { expect, test } from "@playwright/test";

test("ownership homepage retains product and learning content", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("#ownership-title")).toBeVisible();
  await expect(page.locator("#evaluate-title")).toHaveText("Big potential.A closer look.");
  await expect(page.locator("#own-title")).toContainText("A new beginning.");
  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(page.locator(".home-guide-grid a")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Explore businesses" })).toHaveAttribute("href", "/en/listings");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.locator("#ownership-title").evaluate(el => el.closest("section")?.style.getPropertyValue("--journey"))).toBe("1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
