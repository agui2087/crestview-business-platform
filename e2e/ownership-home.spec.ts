import { expect, test } from "@playwright/test";

test("building motion eases across scroll steps and settles in both directions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Desktop sticky motion is tested separately from phone artwork.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en");
  const scene = page.locator("section[aria-labelledby='ownership-title']");
  await expect.poll(() => scene.evaluate(el => el.style.getPropertyValue("--journey"))).toBe("0");
  const firstFrame = await scene.evaluate(async el => {
    document.documentElement.style.scrollBehavior = "auto";
    scrollTo(0, el.getBoundingClientRect().top + scrollY + 225);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return Number((el as HTMLElement).style.getPropertyValue("--journey"));
  });
  expect(firstFrame).toBeLessThan(0.95);
  await expect.poll(() => scene.evaluate(el => Number(el.style.getPropertyValue("--journey")))).toBe(1);
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => scene.evaluate(el => Number(el.style.getPropertyValue("--journey")))).toBe(0);
});

test("phone artwork moves while visible and respects reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  for (const title of ["ownership-title", "evaluate-title", "own-title"]) {
    const section = page.locator(`section[aria-labelledby='${title}']`);
    const artwork = section.locator("svg").filter({ has: page.locator("g") }).first();
    const part = artwork.locator(title === "ownership-title" ? "g[class*='office']" : "g[class]").first();
    const top = await artwork.evaluate(el => el.getBoundingClientRect().top + scrollY);
    await page.evaluate(y => scrollTo(0, y), Math.max(0, top - 560));
    await page.waitForTimeout(800);
    const before = await part.evaluate(el => getComputedStyle(el).transform);
    await page.evaluate(y => scrollTo(0, y), Math.max(0, top - 150));
    await expect.poll(() => part.evaluate(el => getComputedStyle(el).transform)).not.toBe(before);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const office = page.locator("section[aria-labelledby='ownership-title'] g[class*='office']");
  await expect.poll(() => office.evaluate(el => getComputedStyle(el).transform)).toBe("none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

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
