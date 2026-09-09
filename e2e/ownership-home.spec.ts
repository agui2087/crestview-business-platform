import { expect, test } from "@playwright/test";

test("desktop scene stays pinned without leaving an empty scroll tail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Mobile uses a naturally flowing scene.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  const scene = page.locator("section[aria-labelledby='ownership-title']");
  const metrics = await scene.evaluate(el => ({ top: el.getBoundingClientRect().top + scrollY, height: el.getBoundingClientRect().height }));
  await page.evaluate(top => scrollTo(0, top + 100), metrics.top);
  await expect.poll(() => scene.evaluate(el => Math.abs(el.firstElementChild!.getBoundingClientRect().top))).toBeLessThan(2);
  // At release, the following chapter must touch the bottom of the scene.
  await page.evaluate(top => scrollTo(0, top + 350), metrics.top);
  const gap = await scene.evaluate(el => {
    const next = document.querySelector("section[aria-labelledby='evaluate-title']")!;
    return next.getBoundingClientRect().top - el.firstElementChild!.getBoundingClientRect().bottom;
  });
  expect(Math.abs(gap)).toBeLessThan(2);
  expect(metrics.height).toBeLessThanOrEqual(900 * 1.26);
});

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
