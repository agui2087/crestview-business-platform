import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

for (const locale of ["en", "es"]) {
  test(`PDF renderer displays a real page and accessible text (${locale})`, async ({ page }) => {
    await page.route("**/__pdf-fixture.pdf*", route => route.fulfill({ path: path.resolve("e2e/fixtures/synthetic.pdf"), contentType: "application/pdf" }));
    await page.goto(`/pdf-viewer-test?locale=${locale}`);
    await expect(page.getByText("SYNTHETIC TEST ONLY", { exact: false }).last()).toBeAttached({timeout:60000});
    await expect(page.locator(".secure-pdf").getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("link", { name: locale === "es" ? "Descargar PDF" : "Download PDF", exact:true })).toBeVisible();
    expect(await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
      const pixels=canvas.getContext("2d")!.getImageData(0,0,canvas.width,canvas.height).data;
      let ink=0; for(let i=0;i<pixels.length;i+=4) if(pixels[i]<180 && pixels[i+1]<180 && pixels[i+2]<180) ink++;
      return ink;
    })).toBeGreaterThan(100);
    await page.getByRole("combobox",{name:locale === "es" ? "Ampliación" : "Zoom"}).selectOption("1.5");
    await expect(page.getByRole("status")).toHaveCount(0);
    const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  });
}

test("PDF failure retains explicit download and recovery guidance",async({page})=>{
  await page.route("**/__pdf-fixture.pdf*",route=>route.fulfill({status:403,body:"Expired"}));
  await page.goto("/pdf-viewer-test");
  await expect(page.locator(".secure-pdf").getByRole("alert")).toContainText("could not be displayed",{timeout:60000});
  await expect(page.getByRole("link",{name:"Download PDF",exact:true})).toBeVisible();
});
